import { ShellyData } from '../shellyTypes.js';

// Sample output Gen 3 Shelly PM Mini for 192.168.1.220/shelly
export const shellypmminig3Shelly: ShellyData = {
  'name': null,
  'id': 'shellypmminig3-84fce63957f4',
  'mac': '84FCE63957F4',
  'slot': 0,
  'model': 'S3PM-001PCEU16',
  'gen': 3,
  'fw_id': '20240430-105737/1.3.1-gd8534ee',
  'ver': '1.3.1',
  'app': 'MiniPMG3',
  'auth_en': false,
  'auth_domain': null,
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.220/rpc/Shelly.GetStatus
export const shellypmminig3Status: ShellyData = {
  'ble': {},
  'bthome': {
    'errors': ['bluetooth_disabled'],
  },
  'cloud': {
    'connected': true,
  },
  'mqtt': {
    'connected': false,
  },
  'pm1:0': {
    'id': 0,
    'voltage': 237.4,
    'current': 0,
    'apower': 0,
    'freq': 49.9,
    'aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1716240240,
    },
    'ret_aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1716240240,
    },
  },
  'sys': {
    'mac': '84FCE63957F4',
    'restart_required': false,
    'time': '23:24',
    'unixtime': 1716240292,
    'uptime': 37815,
    'ram_size': 261624,
    'ram_free': 152356,
    'fs_size': 1048576,
    'fs_free': 712704,
    'cfg_rev': 12,
    'kvs_rev': 0,
    'schedule_rev': 1,
    'webhook_rev': 0,
    'available_updates': {},
    'reset_reason': 3,
  },
  'wifi': {
    'sta_ip': '192.168.1.220',
    'status': 'got ip',
    'ssid': 'FibreBox_X6-12A4C7',
    'rssi': -52,
  },
  'ws': {
    'connected': false,
  },
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.220/rpc/Shelly.GetConfig
export const shellypmminig3Settings: ShellyData = {
  'ble': {
    'enable': false,
    'rpc': {
      'enable': true,
    },
    'observer': {
      'enable': false,
    },
  },
  'bthome': {},
  'cloud': {
    'enable': true,
    'server': 'shelly-103-eu.shelly.cloud:6022/jrpc',
  },
  'mqtt': {
    'enable': false,
    'server': null,
    'client_id': 'shellypmminig3-84fce63957f4',
    'user': null,
    'ssl_ca': null,
    'topic_prefix': 'shellypmminig3-84fce63957f4',
    'rpc_ntf': true,
    'status_ntf': false,
    'use_client_cert': false,
    'enable_rpc': true,
    'enable_control': true,
  },
  'pm1:0': {
    'id': 0,
    'name': null,
  },
  'sys': {
    'device': {
      'name': 'MiniPMG3',
      'mac': '84FCE63957F4',
      'fw_id': '20240430-105737/1.3.1-gd8534ee',
      'discoverable': true,
      'eco_mode': false,
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
      'ssid': 'ShellyPMMiniG3-84FCE63957F4',
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
