import { ShellyData } from './shellyDevice.js';

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.218/shelly
export const shellyplus2pmShelly: ShellyData = {
  'name': null,
  'id': 'shellyplus2pm-5443b23d81f8',
  'mac': '5443B23D81F8',
  'slot': 0,
  'model': 'SNSW-102P16EU',
  'gen': 2,
  'fw_id': '20240430-105737/1.3.1-gd8534ee',
  'ver': '1.3.1',
  'app': 'Plus2PM',
  'auth_en': false,
  'auth_domain': null,
  'profile': 'switch',
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.218/rpc/Shelly.GetStatus
export const shellyplus2pmStatus: ShellyData = {
  'ble': {},
  'cloud': {
    'connected': true,
  },
  'input:0': {
    'id': 0,
    'state': null,
  },
  'input:1': {
    'id': 1,
    'state': false,
  },
  'mqtt': {
    'connected': false,
  },
  'switch:0': {
    'id': 0,
    'source': 'WS_in',
    'output': false,
    'apower': 0,
    'voltage': 237.1,
    'freq': 50,
    'current': 0,
    'pf': 0,
    'aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1715923860,
    },
    'ret_aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1715923860,
    },
    'temperature': {
      'tC': 52.4,
      'tF': 126.2,
    },
  },
  'switch:1': {
    'id': 1,
    'source': 'WS_in',
    'output': false,
    'apower': 0,
    'voltage': 237.1,
    'freq': 50,
    'current': 0,
    'pf': 0,
    'aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1715923860,
    },
    'ret_aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1715923860,
    },
    'temperature': {
      'tC': 52.4,
      'tF': 126.2,
    },
  },
  'sys': {
    'mac': '5443B23D81F8',
    'restart_required': false,
    'time': '07:31',
    'unixtime': 1715923918,
    'uptime': 373141,
    'ram_size': 260172,
    'ram_free': 115580,
    'fs_size': 458752,
    'fs_free': 126976,
    'cfg_rev': 13,
    'kvs_rev': 0,
    'schedule_rev': 0,
    'webhook_rev': 0,
    'available_updates': {},
    'reset_reason': 1,
  },
  'wifi': {
    'sta_ip': '192.168.1.218',
    'status': 'got ip',
    'ssid': 'FibreBox_X6-12A4C7',
    'rssi': -60,
  },
  'ws': {
    'connected': false,
  },
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.218/rpc/Shelly.GetConfig
export const shellyplus2pmSettings: ShellyData = {
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
  'input:1': {
    'id': 1,
    'name': null,
    'type': 'switch',
    'enable': true,
    'invert': false,
    'factory_reset': true,
  },
  'mqtt': {
    'enable': false,
    'server': null,
    'client_id': 'shellyplus2pm-5443b23d81f8',
    'user': null,
    'ssl_ca': null,
    'topic_prefix': 'shellyplus2pm-5443b23d81f8',
    'rpc_ntf': true,
    'status_ntf': false,
    'use_client_cert': false,
    'enable_rpc': true,
    'enable_control': true,
  },
  'switch:0': {
    'id': 0,
    'name': null,
    'in_mode': 'momentary',
    'initial_state': 'restore_last',
    'auto_on': false,
    'auto_on_delay': 60,
    'auto_off': false,
    'auto_off_delay': 60,
    'power_limit': 2800,
    'voltage_limit': 280,
    'undervoltage_limit': 0,
    'autorecover_voltage_errors': false,
    'current_limit': 10,
  },
  'switch:1': {
    'id': 1,
    'name': null,
    'in_mode': 'follow',
    'initial_state': 'match_input',
    'auto_on': false,
    'auto_on_delay': 60,
    'auto_off': false,
    'auto_off_delay': 60,
    'power_limit': 2800,
    'voltage_limit': 280,
    'undervoltage_limit': 0,
    'autorecover_voltage_errors': false,
    'current_limit': 10,
  },
  'sys': {
    'device': {
      'name': 'Device shellyplus2pm',
      'mac': '5443B23D81F8',
      'fw_id': '20240430-105737/1.3.1-gd8534ee',
      'discoverable': true,
      'eco_mode': false,
      'profile': 'switch',
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
    'cfg_rev': 12,
  },
  'wifi': {
    'ap': {
      'ssid': 'ShellyPlus2PM-5443B23D81F8',
      'is_open': true,
      'enable': false,
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
