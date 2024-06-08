import { ShellyData } from './shellyTypes.js';

// Sample output Gen 3 Shelly PM Mini for 192.168.1.221/shelly
export const shellyplusi4Shelly: ShellyData = {
  'name': 'My Shelly i4',
  'id': 'shellyplusi4-cc7b5c8aea2c',
  'mac': 'CC7B5C8AEA2C',
  'slot': 0,
  'model': 'SNSN-0024X',
  'gen': 2,
  'fw_id': '20240522-112836/1.3.2-g34c651b',
  'ver': '1.3.2',
  'app': 'PlusI4',
  'auth_en': false,
  'auth_domain': null,
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.221/rpc/Shelly.GetStatus
export const shellyplusi4Status: ShellyData = {
  'ble': {},
  'cloud': {
    'connected': true,
  },
  'input:0': {
    'id': 0,
    'state': false,
  },
  'input:1': {
    'id': 1,
    'state': false,
  },
  'input:2': {
    'id': 2,
    'state': false,
  },
  'input:3': {
    'id': 3,
    'state': false,
  },
  'mqtt': {
    'connected': false,
  },
  'sys': {
    'mac': 'CC7B5C8AEA2C',
    'restart_required': false,
    'time': '22:24',
    'unixtime': 1717791874,
    'uptime': 180183,
    'ram_size': 247212,
    'ram_free': 140956,
    'fs_size': 458752,
    'fs_free': 147456,
    'cfg_rev': 12,
    'kvs_rev': 0,
    'schedule_rev': 0,
    'webhook_rev': 0,
    'available_updates': {},
    'reset_reason': 3,
  },
  'wifi': {
    'sta_ip': '192.168.1.224',
    'status': 'got ip',
    'ssid': 'FibreBox_X6-12A4C7',
    'rssi': -47,
  },
  'ws': {
    'connected': false,
  },
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.221/rpc/Shelly.GetConfig
export const shellyplusi4Settings: ShellyData = {
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
    'type': 'switch',
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
  'input:2': {
    'id': 2,
    'name': null,
    'type': 'switch',
    'enable': true,
    'invert': false,
    'factory_reset': true,
  },
  'input:3': {
    'id': 3,
    'name': null,
    'type': 'switch',
    'enable': true,
    'invert': false,
    'factory_reset': true,
  },
  'mqtt': {
    'enable': false,
    'server': null,
    'client_id': 'shellyplusi4-cc7b5c8aea2c',
    'user': null,
    'ssl_ca': null,
    'topic_prefix': 'shellyplusi4-cc7b5c8aea2c',
    'rpc_ntf': true,
    'status_ntf': false,
    'use_client_cert': false,
    'enable_rpc': true,
    'enable_control': true,
  },
  'sys': {
    'device': {
      'name': 'My Shelly i4',
      'mac': 'CC7B5C8AEA2C',
      'fw_id': '20240522-112836/1.3.2-g34c651b',
      'discoverable': true,
      'eco_mode': false,
      'addon_type': null,
    },
    'location': {
      'tz': 'Europe/Monaco',
      'lat': 43.7314,
      'lon': 7.419,
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
      'ssid': 'ShellyPlusI4-CC7B5C8AEA2C',
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
