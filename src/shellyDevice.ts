/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { AnsiLogger, TimestampFormat, db, debugStringify, dn, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { EventEmitter } from 'events';
import fetch from 'node-fetch';

type ShellyData = {
  [key: string]: string | number | boolean | null | undefined | object;
};

export interface ShellyComponent {
  key: string;
  name: string;
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
    return this.components.set(component.key, component);
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
    device.mac = shelly['mac'] as string;
    if (!shelly.gen) {
      const settings = await ShellyDevice.getShelly(host, 'settings');
      if (!settings) return null;
      device.model = shelly.type as string;
      device.id = (settings.device as ShellyData).hostname as string;
      device.firmware = (shelly.fw as string).split('/')[1];
      device.auth = shelly.auth as boolean;
      for (const key in settings) {
        if (key === 'wifi_ap') device.addComponent({ key, name: 'WiFi' });
        if (key === 'wifi_sta') device.addComponent({ key, name: 'WiFi' });
        if (key === 'wifi_sta1') device.addComponent({ key, name: 'WiFi' });
        if (key === 'mqtt') device.addComponent({ key, name: 'MQTT' });
        if (key === 'coiot') device.addComponent({ key, name: 'CoIoT' });
        if (key === 'sntp') device.addComponent({ key, name: 'Sntp' });
        if (key === 'cloud') device.addComponent({ key, name: 'Cloud' });
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
          if (wifi.ap) device.addComponent({ key: 'wifi_ap', name: 'WiFi' }); //Ok
          if (wifi.sta) device.addComponent({ key: 'wifi_sta', name: 'WiFi' }); //Ok
          if (wifi.sta1) device.addComponent({ key: 'wifi_sta1', name: 'WiFi' }); //Ok
        }
        if (key === 'sys') {
          const sys = settings[key] as ShellyData;
          if (sys.sntp) device.addComponent({ key: 'sntp', name: 'Sntp' }); //Ok
        }
        if (key === 'mqtt') device.addComponent({ key, name: 'MQTT' }); //Ok
        if (key === 'ws') device.addComponent({ key, name: 'WebSocket' }); // Ok
        if (key === 'cloud') device.addComponent({ key, name: 'Cloud' }); // Ok
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
}

if (process.argv.includes('shelly')) {
  const log = new AnsiLogger({ logName: 'shellyDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
  let shelly = await ShellyDevice.create(log, '192.168.1.217');
  // eslint-disable-next-line no-console
  console.log('Shelly:', shelly);
  shelly = await ShellyDevice.create(log, '192.168.1.218');
  // eslint-disable-next-line no-console
  console.log('Shelly:', shelly);
  shelly = await ShellyDevice.create(log, '192.168.1.219');
  // eslint-disable-next-line no-console
  if (shelly) {
    shelly.addComponent({ key: 'switch:0', name: 'Switch' });
    console.log('Shelly:', shelly);
    for (const [key, component] of shelly) {
      console.log(`  - ${component.name} (${key})`);
    }
  }
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
