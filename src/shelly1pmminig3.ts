import { ShellyData } from './shellyTypes.js';

// Sample output Gen 3 Shelly PM Mini for 192.168.1.221/shelly
export const shelly1pmminig3Shelly: ShellyData = {
  'name': 'My shelly 1PM mini',
  'id': 'shelly1pmminig3-543204519264',
  'mac': '543204519264',
  'slot': 1,
  'model': 'S3SW-001P8EU',
  'gen': 3,
  'fw_id': '20231121-110955/1.1.99-minig3prod1-ga898543',
  'ver': '1.1.99-minig3prod1',
  'app': 'Mini1PMG3',
  'auth_en': false,
  'auth_domain': null,
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.221/rpc/Shelly.GetStatus
export const shelly1pmminig3Status: ShellyData = {
  'ble': {},
  'cloud': {
    'connected': true,
  },
  'input:0': {
    'id': 0,
    'state': false,
  },
  'mqtt': {
    'connected': false,
  },
  'switch:0': {
    'id': 0,
    'source': 'HTTP_in',
    'output': false,
    'apower': 0,
    'voltage': 237.1,
    'freq': 50.1,
    'current': 0,
    'aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1717791991,
    },
    'ret_aenergy': {
      'total': 0,
      'by_minute': [0, 0, 0],
      'minute_ts': 1717791991,
    },
    'temperature': {
      'tC': 62.4,
      'tF': 144.3,
    },
  },
  'sys': {
    'mac': '543204519264',
    'restart_required': false,
    'time': '20:26',
    'unixtime': 1717791992,
    'uptime': 124286,
    'ram_size': 260424,
    'ram_free': 146316,
    'fs_size': 1048576,
    'fs_free': 708608,
    'cfg_rev': 10,
    'kvs_rev': 1,
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
    'sta_ip': '192.168.1.225',
    'status': 'got ip',
    'ssid': 'FibreBox_X6-12A4C7',
    'rssi': -57,
  },
  'ws': {
    'connected': false,
  },
};

// Sample output Gen 2 Shelly Plus 2PM for 192.168.1.221/rpc/Shelly.GetConfig
export const shelly1pmminig3Settings: ShellyData = {
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
  'mqtt': {
    'enable': false,
    'server': null,
    'client_id': 'shelly1pmminig3-543204519264',
    'user': null,
    'topic_prefix': 'shelly1pmminig3-543204519264',
    'rpc_ntf': true,
    'status_ntf': false,
    'use_client_cert': false,
    'enable_rpc': true,
    'enable_control': true,
  },
  'switch:0': {
    'id': 0,
    'name': null,
    'in_mode': 'follow',
    'initial_state': 'match_input',
    'auto_on': false,
    'auto_on_delay': 60,
    'auto_off': false,
    'auto_off_delay': 60,
    'power_limit': 2240,
    'voltage_limit': 280,
    'autorecover_voltage_errors': false,
    'current_limit': 8,
  },
  'sys': {
    'device': {
      'name': 'My shelly 1PM mini',
      'mac': '543204519264',
      'fw_id': '20231121-110955/1.1.99-minig3prod1-ga898543',
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
    'cfg_rev': 10,
  },
  'wifi': {
    'ap': {
      'ssid': 'Shelly1PMMiniG3-543204519264',
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
