import { ShellyData } from './shellyDevice.js';

// Sample output Gen 2 Shelly Plus 1PM for 192.168.1.217/shelly
export const shellyplus1pmShelly: ShellyData = {
  'name': null,
  'id': 'shellyplus1pm-441793d69718',
  'mac': '441793D69718',
  'slot': 0,
  'model': 'SNSW-001P16EU',
  'gen': 2,
  'fw_id': '20240430-105751/1.3.1-gd8534ee',
  'ver': '1.3.1',
  'app': 'Plus1PM',
  'auth_en': false,
  'auth_domain': null,
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.217/rpc/Shelly.GetStatus
export const shellyplus1pmStatus: ShellyData = {
  'ble': {},
  'cloud': {
    'connected': true,
  },
  'input:0': {
    'id': 0,
    'state': null,
  },
  'mqtt': {
    'connected': false,
  },
  'switch:0': {
    'id': 0,
    'source': 'HTTP_in',
    'output': false,
    'apower': 0,
    'voltage': 239,
    'current': 0,
    'aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1716299460,
    },
    'temperature': {
      'tC': 58.9,
      'tF': 138,
    },
  },
  'sys': {
    'mac': '441793D69718',
    'restart_required': false,
    'time': '15:51',
    'unixtime': 1716299487,
    'uptime': 98032,
    'ram_size': 261512,
    'ram_free': 118004,
    'fs_size': 458752,
    'fs_free': 139264,
    'cfg_rev': 23,
    'kvs_rev': 0,
    'schedule_rev': 0,
    'webhook_rev': 0,
    'available_updates': {},
    'reset_reason': 1,
  },
  'wifi': {
    'sta_ip': '192.168.1.217',
    'status': 'got ip',
    'ssid': 'FibreBox_X6-12A4C7',
    'rssi': -62,
  },
  'ws': {
    'connected': false,
  },
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.217/rpc/Shelly.GetConfig
export const shellyplus1pmSettings: ShellyData = {
  'ble': {
    'enable': true,
    'rpc': {
      'enable': true,
    },
    'observer': {
      'enable': false,
    },
  },
  'cloud': {
    'enable': true,
    'server': 'shelly-103-eu.shelly.cloud:6022/jrpc',
  },
  'input:0': {
    'id': 0,
    'name': null,
    'type': 'button',
    'enable': true,
    'invert': false,
    'factory_reset': true,
  },
  'mqtt': {
    'enable': false,
    'server': null,
    'client_id': 'shellyplus1pm-441793d69718',
    'user': null,
    'ssl_ca': null,
    'topic_prefix': 'shellyplus1pm-441793d69718',
    'rpc_ntf': true,
    'status_ntf': false,
    'use_client_cert': false,
    'enable_rpc': true,
    'enable_control': true,
  },
  'switch:0': {
    'id': 0,
    'name': 'Power switch',
    'in_mode': 'detached',
    'initial_state': 'restore_last',
    'auto_on': false,
    'auto_on_delay': 60,
    'auto_off': false,
    'auto_off_delay': 60,
    'power_limit': 4480,
    'voltage_limit': 280,
    'autorecover_voltage_errors': false,
    'current_limit': 16,
  },
  'sys': {
    'device': {
      'name': 'Plus1PM name',
      'mac': '441793D69718',
      'fw_id': '20240430-105751/1.3.1-gd8534ee',
      'discoverable': true,
      'eco_mode': false,
      'addon_type': null,
    },
    'location': {
      'tz': 'Europe/Monaco',
      'lat': 43.7312,
      'lon': 7.4138,
    },
    'debug': {
      'level': 2,
      'file_level': null,
      'mqtt': {
        'enable': false,
      },
      'websocket': {
        'enable': false,
      },
      'udp': {
        'addr': null,
      },
    },
    'ui_data': {},
    'rpc_udp': {
      'dst_addr': null,
      'listen_port': null,
    },
    'sntp': {
      'server': 'time.google.com',
    },
    'cfg_rev': 23,
  },
  'wifi': {
    'ap': {
      'ssid': 'ShellyPlus1PM-441793D69718',
      'is_open': true,
      'enable': true,
      'range_extender': {
        'enable': false,
      },
    },
    'sta': {
      'ssid': 'FibreBox_X6-12A4C7',
      'is_open': false,
      'enable': true,
      'ipv4mode': 'dhcp',
      'ip': null,
      'netmask': null,
      'gw': null,
      'nameserver': null,
    },
    'sta1': {
      'ssid': null,
      'is_open': true,
      'enable': false,
      'ipv4mode': 'dhcp',
      'ip': null,
      'netmask': null,
      'gw': null,
      'nameserver': null,
    },
    'roam': {
      'rssi_thr': -80,
      'interval': 60,
    },
  },
  'ws': {
    'enable': false,
    'server': null,
    'ssl_ca': 'ca.pem',
  },
};
