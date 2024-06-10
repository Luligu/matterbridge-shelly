import { ShellyData } from '../shellyTypes.js';

// Sample output Gen 3 Shelly PM Mini for 192.168.1.221/shelly
export const shelly1minig3Shelly: ShellyData = {
  'name': 'Mini switch gen 3',
  'id': 'shelly1minig3-543204547478',
  'mac': '543204547478',
  'slot': 1,
  'model': 'S3SW-001X8EU',
  'gen': 3,
  'fw_id': '20231121-110944/1.1.99-minig3prod1-ga898543',
  'ver': '1.1.99-minig3prod1',
  'app': 'Mini1G3',
  'auth_en': false,
  'auth_domain': null,
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.221/rpc/Shelly.GetStatus
export const shelly1minig3Status: ShellyData = {
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
    'source': 'WS_in',
    'output': false,
    'temperature': {
      'tC': 57,
      'tF': 134.7,
    },
  },
  'sys': {
    'mac': '543204547478',
    'restart_required': false,
    'time': '21:08',
    'unixtime': 1716584919,
    'uptime': 108290,
    'ram_size': 260708,
    'ram_free': 146740,
    'fs_size': 1048576,
    'fs_free': 708608,
    'cfg_rev': 16,
    'kvs_rev': 4,
    'schedule_rev': 0,
    'webhook_rev': 0,
    'available_updates': {
      'stable': {
        'version': '1.3.2',
      },
    },
    'reset_reason': 3,
  },
  'wifi': {
    'sta_ip': '192.168.1.221',
    'status': 'got ip',
    'ssid': 'FibreBox_X6-12A4C7',
    'rssi': -53,
  },
  'ws': {
    'connected': false,
  },
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.221/rpc/Shelly.GetConfig
export const shelly1minig3Settings: ShellyData = {
  'ble': {
    'enable': false,
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
    'client_id': 'shelly1minig3-543204547478',
    'user': null,
    'topic_prefix': 'shelly1minig3-543204547478',
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
  },
  'sys': {
    'device': {
      'name': 'Mini switch gen 3',
      'mac': '543204547478',
      'fw_id': '20231121-110944/1.1.99-minig3prod1-ga898543',
      'discoverable': true,
      'eco_mode': false,
    },
    'location': {
      'tz': null,
      'lat': null,
      'lon': null,
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
    'cfg_rev': 16,
  },
  'wifi': {
    'ap': {
      'ssid': 'Shelly1MiniG3-543204547478',
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
