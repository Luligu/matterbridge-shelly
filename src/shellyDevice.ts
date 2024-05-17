/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { AnsiLogger, TimestampFormat, db, debugStringify, dn, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

export type ShellyData = {
  [key: string]: ShellyDataType;
};

export type ShellyDataType = string | number | boolean | null | undefined | object;

export class ShellyProperty {
  key: string;
  _value: ShellyDataType;
  constructor(readonly key: string, value: ShellyDataType) {
    this.key = key;
    this._value = value;
  }
  
  get value(): string {
    return this._value;
  }
}

export class ShellyComponent {
  key: string;
  name: string;
  properties = new Map<string, ShellyProperty>();
  hasProperty(key: string): boolean {
    return this.properties.has(key);
  }
  getProperty(key: string): ShellyProperty | undefined {
    return this.properties.get(key);
  }
  addProperty(property: ShellyProperty) {
    this.properties.set(property.key, property);
    return this;
  }
  *[Symbol.iterator](): IterableIterator<[string, ShellyProperty]> {
    for (const [key, property] of this.properties.entries()) {
      yield [key, property];
    }
  }
  constructor(readonly key: string, name: string) {
    this.key = key;
    this.name = name;
  }
  //device: Device;
  //update(data: Record<string, unknown>);
  //handleEvent(event: RpcEvent);
}

export class ShellyDevice extends EventEmitter {
  readonly log: AnsiLogger;
  readonly host: string;
  id = '';
  model = '';
  mac = '';
  firmware = '';
  auth = false;

  name = '';
  online = false;

  private components = new Map<string, ShellyComponent>();

  hasComponent(key: string): boolean {
    return this.components.has(key);
  }

  getComponent(key: string): ShellyComponent | undefined {
    return this.components.get(key);
  }

  addComponent(component: ShellyComponent) {
    this.components.set(component.key, component);
    return component;
  }

  *[Symbol.iterator](): IterableIterator<[string, ShellyComponent]> {
    for (const [key, component] of this.components.entries()) {
      yield [key, component];
    }
  }

  constructor(log: AnsiLogger, host: string) {
    super();
    this.log = log;
    this.host = host;
  }

  static async create(log: AnsiLogger, host: string): Promise<ShellyDevice | null> {
    const shelly = await ShellyDevice.getShelly(host);
    if (!shelly) return null;
    console.log('Shelly:', shelly);

    const device = new ShellyDevice(log, host);
    device.mac = shelly.mac as string;
    if (!shelly.gen) {
      const settings = await ShellyDevice.getShelly(host, 'settings');
      if (!settings) return null;
      device.model = shelly.type as string;
      device.id = (settings.device as ShellyData).hostname as string;
      device.firmware = (shelly.fw as string).split('/')[1];
      device.auth = shelly.auth as boolean;
      device.name = settings.name as string;

      //device.addComponent(new ShellyComponent('wifi_ap', 'WiFi'));
      for (const key in settings) {
        if (key === 'wifi_ap') device.addComponent(new ShellyComponent(key, 'WiFi'));
        if (key === 'wifi_sta') device.addComponent(new ShellyComponent(key, 'WiFi'));
        if (key === 'wifi_sta1') device.addComponent(new ShellyComponent(key, 'WiFi'));
        if (key === 'mqtt') device.addComponent(new ShellyComponent(key, 'MQTT'));
        if (key === 'coiot') device.addComponent(new ShellyComponent(key, 'CoIoT'));
        if (key === 'sntp') device.addComponent(new ShellyComponent(key, 'Sntp'));
        if (key === 'cloud') device.addComponent(new ShellyComponent(key, 'Cloud'));
        if (key === 'lights') {
          const lights = settings[key] as ShellyData[];
          let index = 0;
          for (const light of lights) {
            const component = device.addComponent(new ShellyComponent(`light:${index++}`, 'Light'));
            const properties = light as ShellyData;
            for (const prop in properties) {
              component.addProperty(new ShellyProperty(prop, properties[prop] as string));
            }
          }
        }
      }
    }
    if (shelly.gen === 2) {
      const settings = await ShellyDevice.getShelly(host, 'rpc/Shelly.GetConfig');
      if (!settings) return null;
      device.model = shelly.model as string;
      device.id = shelly.id as string;
      device.firmware = (shelly.fw_id as string).split('/')[1];
      device.auth = shelly.auth_en as boolean;
      for (const key in settings) {
        if (key === 'wifi') {
          const wifi = settings[key] as ShellyData;
          if (wifi.ap) device.addComponent(new ShellyComponent('wifi_ap', 'WiFi')); //Ok
          if (wifi.sta) device.addComponent(new ShellyComponent('wifi_sta', 'WiFi')); //Ok
          if (wifi.sta1) device.addComponent(new ShellyComponent('wifi_sta1', 'WiFi')); //Ok
        }
        if (key === 'sys') {
          const sys = settings[key] as ShellyData;
          if (sys.sntp) {
            device.addComponent(new ShellyComponent('sntp', 'Sntp')); //Ok
            const dev = sys.device as ShellyData;
            device.name = dev.name as string;
          }
        }
        if (key === 'mqtt') device.addComponent(new ShellyComponent(key, 'MQTT')); //Ok
        if (key === 'ws') device.addComponent(new ShellyComponent(key, 'WebSocket')); // Ok
        if (key === 'cloud') device.addComponent(new ShellyComponent(key, 'Cloud')); // Ok
        if (key.startsWith('switch:')) {
          const component = device.addComponent(new ShellyComponent(key, 'Switch'));
          const properties = settings[key] as ShellyData;
          for (const prop in properties) {
            component.addProperty(new ShellyProperty(prop, properties[prop] as string));
          }
        }
      }
    }
    return device;
  }

  static async getShelly(host: string, service: string = 'shelly'): Promise<ShellyData | null> {
    try {
      const response = await fetch(`http://${host}/${service}`);
      if (!response.ok) {
        console.error('Error fetching shelly:');
        return null;
      }
      const data = await response.json();
      // console.log(data);
      return data as ShellyData;
    } catch (error) {
      console.error('Error fetching shelly:', error);
      return null;
    }
  }

  static async sendCommand(hostname: string, service: string, index: number, command: string): Promise<unknown | null> {
    try {
      // Replace the URL with your target URL
      const response = await fetch(`http://${hostname}/${service}/${index}?${command}`);
      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error('Error fetching shelly:');
        return null;
      }
      const data = await response.json();
      // eslint-disable-next-line no-console
      // console.log(data);
      return data;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching shelly:', error);
      return null;
    }
  }

  async writeFile(filePath: string, data: string) {
    // Write the data to a file
    await fs
      .writeFile(`${filePath}`, data, 'utf8')
      .then(() => {
        this.log.debug(`Successfully wrote to ${filePath}`);
      })
      .catch((error) => {
        this.log.error(`Error writing to ${filePath}:`, error);
      });
  }
}

if (process.argv.includes('shelly')) {
  const log = new AnsiLogger({ logName: 'shellyDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

  let shelly = await ShellyDevice.create(log, '192.168.1.217');
  if (shelly) {
    //const data = ShellyDevice.getShelly(shelly.host, 'settings');
    //await shelly.writeFile(shelly.id, data);
    console.log('Shelly:', shelly);
    for (const [key, component] of shelly) {
      console.log(`  - ${component.name} (${key})`);
      for (const [key, property] of component) {
        console.log(`    - ${key}: ${property.value}`);
      }
    }
  }

  shelly = await ShellyDevice.create(log, '192.168.1.218');
  if (shelly) {
    console.log('Shelly:', shelly);
    for (const [key, component] of shelly) {
      console.log(`  - ${component.name} (${key})`);
      for (const [key, property] of component) {
        console.log(`    - ${key}: ${property.value}`);
      }
    }
  }

  shelly = await ShellyDevice.create(log, '192.168.1.219');
  if (shelly) {
    console.log('Shelly:', shelly);
    for (const [key, component] of shelly) {
      console.log(`  - ${component.name} (${key})`);
      for (const [key, property] of component) {
        console.log(`    - ${key}: ${property.value}`);
      }
    }
  }
  //await ShellyDevice.sendCommand('192.168.1.219', 'light', 0, 'turn=on');
}

/* Sample output for host/shelly:
Gen 1 Shelly Dimmer:
{
    "type": "SHDM-2",
    "mac": "98CDAC0D01BB",
    "auth": false,
    "fw": "20230913-114008/v1.14.0-gcb84623",
    "discoverable": false,
    "longid": 1,
    "num_inputs": 2,
    "num_outputs": 1,
    "num_meters": 1
}
Gen 2 Shelly Plus 1PM:
{
    "name": null,
    "id": "shellyplus1pm-441793d69718",
    "mac": "441793D69718",
    "slot": 0,
    "model": "SNSW-001P16EU",
    "gen": 2,
    "fw_id": "20240430-105751/1.3.1-gd8534ee",
    "ver": "1.3.1",
    "app": "Plus1PM",
    "auth_en": false,
    "auth_domain": null
}
Gen 2 Shelly Plus 2PM:
{
    "name": null,
    "id": "shellyplus2pm-5443b23d81f8",
    "mac": "5443B23D81F8",
    "slot": 0,
    "model": "SNSW-102P16EU",
    "gen": 2,
    "fw_id": "20240430-105737/1.3.1-gd8534ee",
    "ver": "1.3.1",
    "app": "Plus2PM",
    "auth_en": false,
    "auth_domain": null,
    "profile": "switch"
}
*/
/* Sample output for Gen 1 host/status:
{
  "wifi_sta": {
      "connected": true,
      "ssid": "FibreBox_X6-12A4C7",
      "ip": "192.168.1.219",
      "rssi": -49
  },
  "cloud": {
      "enabled": true,
      "connected": true
  },
  "mqtt": {
      "connected": false
  },
  "time": "07:30",
  "unixtime": 1715923841,
  "serial": 2606,
  "has_update": false,
  "mac": "98CDAC0D01BB",
  "cfg_changed_cnt": 2,
  "actions_stats": {
      "skipped": 0
  },
  "lights": [
      {
          "ison": false,
          "source": "http",
          "has_timer": false,
          "timer_started": 0,
          "timer_duration": 0,
          "timer_remaining": 0,
          "mode": "white",
          "brightness": 100,
          "transition": 0
      }
  ],
  "meters": [
      {
          "power": 0,
          "overpower": 0,
          "is_valid": true,
          "timestamp": 1715931041,
          "counters": [
              0,
              0,
              0
          ],
          "total": 0
      }
  ],
  "inputs": [
      {
          "input": 0,
          "event": "",
          "event_cnt": 0
      },
      {
          "input": 0,
          "event": "",
          "event_cnt": 0
      }
  ],
  "tmp": {
      "tC": 48.68,
      "tF": 119.62,
      "is_valid": true
  },
  "calibrated": false,
  "calib_progress": 0,
  "calib_status": 0,
  "calib_running": 0,
  "wire_mode": 1,
  "forced_neutral": false,
  "overtemperature": false,
  "loaderror": 0,
  "overpower": false,
  "debug": 0,
  "update": {
      "status": "idle",
      "has_update": false,
      "new_version": "20230913-114008/v1.14.0-gcb84623",
      "old_version": "20230913-114008/v1.14.0-gcb84623",
      "beta_version": "20231107-164738/v1.14.1-rc1-g0617c15"
  },
  "ram_total": 49672,
  "ram_free": 36812,
  "fs_size": 233681,
  "fs_free": 119476,
  "uptime": 116135
}
*/
/* Sample output for Gen 1 host/settings:
{
  "device": {
      "type": "SHDM-2",
      "mac": "98CDAC0D01BB",
      "hostname": "shellydimmer2-98CDAC0D01BB",
      "num_inputs": 2,
      "num_outputs": 1,
      "num_meters": 1
  },
  "wifi_ap": {
      "enabled": false,
      "ssid": "shellydimmer2-98CDAC0D01BB",
      "key": ""
  },
  "wifi_sta": {
      "enabled": true,
      "ssid": "FibreBox_X6-12A4C7",
      "ipv4_method": "dhcp",
      "ip": null,
      "gw": null,
      "mask": null,
      "dns": null
  },
  "wifi_sta1": {
      "enabled": false,
      "ssid": null,
      "ipv4_method": "dhcp",
      "ip": null,
      "gw": null,
      "mask": null,
      "dns": null
  },
  "ap_roaming": {
      "enabled": false,
      "threshold": -70
  },
  "mqtt": {
      "enable": false,
      "server": "192.168.33.3:1883",
      "user": "",
      "id": "shellydimmer2-98CDAC0D01BB",
      "reconnect_timeout_max": 60,
      "reconnect_timeout_min": 2,
      "clean_session": true,
      "keep_alive": 60,
      "max_qos": 0,
      "retain": false,
      "update_period": 30
  },
  "coiot": {
      "enabled": true,
      "update_period": 15,
      "peer": "192.168.1.189:5683"
  },
  "sntp": {
      "server": "time.google.com",
      "enabled": true
  },
  "login": {
      "enabled": false,
      "unprotected": false,
      "username": "admin"
  },
  "pin_code": "",
  "name": null,
  "fw": "20230913-114008/v1.14.0-gcb84623",
  "factory_reset_from_switch": true,
  "pon_wifi_reset": false,
  "discoverable": false,
  "build_info": {
      "build_id": "20230913-114008/v1.14.0-gcb84623",
      "build_timestamp": "2023-09-13T11:40:08Z",
      "build_version": "1.0"
  },
  "cloud": {
      "enabled": true,
      "connected": true
  },
  "timezone": "Europe/Monaco",
  "lat": 43.731201,
  "lng": 7.4138,
  "tzautodetect": true,
  "tz_utc_offset": 7200,
  "tz_dst": false,
  "tz_dst_auto": true,
  "time": "14:22",
  "unixtime": 1715862160,
  "led_status_disable": false,
  "debug_enable": false,
  "allow_cross_origin": false,
  "actions": {
      "active": false,
      "names": [
          "btn1_on_url",
          "btn1_off_url",
          "btn1_longpush_url",
          "btn1_shortpush_url",
          "btn2_on_url",
          "btn2_off_url",
          "btn2_longpush_url",
          "btn2_shortpush_url",
          "out_on_url",
          "out_off_url"
      ]
  },
  "hwinfo": {
      "hw_revision": "prod-2021-02",
      "batch_id": 0
  },
  "mode": "white",
  "pulse_mode": 2,
  "pulse_mode_detected": 1,
  "pulse_mode_rebooted": 0,
  "load_autodetect": 1,
  "calibrated": false,
  "transition": 1000,
  "fade_rate": 3,
  "min_brightness": 0,
  "zcross_debounce": 100,
  "bypass": false,
  "lights": [
      {
          "name": "",
          "ison": false,
          "default_state": "last",
          "auto_on": 0,
          "auto_off": 0,
          "schedule": false,
          "night_mode": {
              "enabled": false,
              "start_time": "00:00",
              "end_time": "00:00",
              "brightness": 0
          },
          "schedule_rules": [],
          "btn_type": "one_button",
          "btn_debounce": 80,
          "swap_inputs": 0
      }
  ],
  "night_mode": {
      "enabled": false,
      "start_time": "00:00",
      "end_time": "00:00",
      "brightness": 0
  },
  "warm_up": {
      "enabled": 0,
      "brightness": 100,
      "time": 50
  },
  "eco_mode_enabled": false
}
*/
/* Sample output for Gen 2 host/rpc/Shelly.GetStatus:
{
    "ble": {},
    "cloud": {
        "connected": true
    },
    "input:0": {
        "id": 0,
        "state": null
    },
    "input:1": {
        "id": 1,
        "state": false
    },
    "mqtt": {
        "connected": false
    },
    "switch:0": {
        "id": 0,
        "source": "WS_in",
        "output": false,
        "apower": 0,
        "voltage": 237.1,
        "freq": 50,
        "current": 0,
        "pf": 0,
        "aenergy": {
            "total": 0,
            "by_minute": [
                0,
                0,
                0
            ],
            "minute_ts": 1715923860
        },
        "ret_aenergy": {
            "total": 0,
            "by_minute": [
                0,
                0,
                0
            ],
            "minute_ts": 1715923860
        },
        "temperature": {
            "tC": 52.4,
            "tF": 126.2
        }
    },
    "switch:1": {
        "id": 1,
        "source": "WS_in",
        "output": false,
        "apower": 0,
        "voltage": 237.1,
        "freq": 50,
        "current": 0,
        "pf": 0,
        "aenergy": {
            "total": 0,
            "by_minute": [
                0,
                0,
                0
            ],
            "minute_ts": 1715923860
        },
        "ret_aenergy": {
            "total": 0,
            "by_minute": [
                0,
                0,
                0
            ],
            "minute_ts": 1715923860
        },
        "temperature": {
            "tC": 52.4,
            "tF": 126.2
        }
    },
    "sys": {
        "mac": "5443B23D81F8",
        "restart_required": false,
        "time": "07:31",
        "unixtime": 1715923918,
        "uptime": 373141,
        "ram_size": 260172,
        "ram_free": 115580,
        "fs_size": 458752,
        "fs_free": 126976,
        "cfg_rev": 13,
        "kvs_rev": 0,
        "schedule_rev": 0,
        "webhook_rev": 0,
        "available_updates": {},
        "reset_reason": 1
    },
    "wifi": {
        "sta_ip": "192.168.1.218",
        "status": "got ip",
        "ssid": "FibreBox_X6-12A4C7",
        "rssi": -60
    },
    "ws": {
        "connected": false
    }
}
*/
/* Sample output for Gen 2 host/rpc/Shelly.GetConfig:
{
    "ble": {
        "enable": true,
        "rpc": {
            "enable": true
        },
        "observer": {
            "enable": false
        }
    },
    "cloud": {
        "enable": true,
        "server": "shelly-103-eu.shelly.cloud:6022/jrpc"
    },
    "input:0": {
        "id": 0,
        "name": null,
        "type": "button",
        "enable": true,
        "invert": false,
        "factory_reset": true
    },
    "input:1": {
        "id": 1,
        "name": null,
        "type": "switch",
        "enable": true,
        "invert": false,
        "factory_reset": true
    },
    "mqtt": {
        "enable": false,
        "server": null,
        "client_id": "shellyplus2pm-5443b23d81f8",
        "user": null,
        "ssl_ca": null,
        "topic_prefix": "shellyplus2pm-5443b23d81f8",
        "rpc_ntf": true,
        "status_ntf": false,
        "use_client_cert": false,
        "enable_rpc": true,
        "enable_control": true
    },
    "switch:0": {
        "id": 0,
        "name": null,
        "in_mode": "momentary",
        "initial_state": "restore_last",
        "auto_on": false,
        "auto_on_delay": 60,
        "auto_off": false,
        "auto_off_delay": 60,
        "power_limit": 2800,
        "voltage_limit": 280,
        "undervoltage_limit": 0,
        "autorecover_voltage_errors": false,
        "current_limit": 10
    },
    "switch:1": {
        "id": 1,
        "name": null,
        "in_mode": "follow",
        "initial_state": "match_input",
        "auto_on": false,
        "auto_on_delay": 60,
        "auto_off": false,
        "auto_off_delay": 60,
        "power_limit": 2800,
        "voltage_limit": 280,
        "undervoltage_limit": 0,
        "autorecover_voltage_errors": false,
        "current_limit": 10
    },
    "sys": {
        "device": {
            "name": null,
            "mac": "5443B23D81F8",
            "fw_id": "20240430-105737/1.3.1-gd8534ee",
            "discoverable": true,
            "eco_mode": false,
            "profile": "switch",
            "addon_type": null
        },
        "location": {
            "tz": "Europe/Monaco",
            "lat": 43.7312,
            "lon": 7.4138
        },
        "debug": {
            "level": 2,
            "file_level": null,
            "mqtt": {
                "enable": false
            },
            "websocket": {
                "enable": false
            },
            "udp": {
                "addr": null
            }
        },
        "ui_data": {},
        "rpc_udp": {
            "dst_addr": null,
            "listen_port": null
        },
        "sntp": {
            "server": "time.google.com"
        },
        "cfg_rev": 12
    },
    "wifi": {
        "ap": {
            "ssid": "ShellyPlus2PM-5443B23D81F8",
            "is_open": true,
            "enable": false,
            "range_extender": {
                "enable": false
            }
        },
        "sta": {
            "ssid": "FibreBox_X6-12A4C7",
            "is_open": false,
            "enable": true,
            "ipv4mode": "dhcp",
            "ip": null,
            "netmask": null,
            "gw": null,
            "nameserver": null
        },
        "sta1": {
            "ssid": null,
            "is_open": true,
            "enable": false,
            "ipv4mode": "dhcp",
            "ip": null,
            "netmask": null,
            "gw": null,
            "nameserver": null
        },
        "roam": {
            "rssi_thr": -80,
            "interval": 60
        }
    },
    "ws": {
        "enable": false,
        "server": null,
        "ssl_ca": "ca.pem"
    }
}
*/
