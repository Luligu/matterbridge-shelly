# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge shelly plugin

[![npm version](https://img.shields.io/npm/v/matterbridge-shelly.svg)](https://www.npmjs.com/package/matterbridge-shelly)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-shelly.svg)](https://www.npmjs.com/package/matterbridge-shelly)
![Node.js CI](https://github.com/Luligu/matterbridge-shelly/actions/workflows/build%20matterbridge%20plugin.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

This plugin allows you to expose Shelly Gen 1, Gen 2, and Gen 3 devices to Matter.

Features:

- Shellies are automatically discovered using mDNS.
- Discovered shellies are stored in local storage for quick loading on startup.
- In this first release, the components exposed are lights (with brightness), switches, and rollers.
- Shellies are controlled locally, eliminating the need for cloud or MQTT (which can be disabled).
- Shelly Gen 1 devices are controlled using the CoIoT protocol (see the note below).
- Shelly Gen 2 and Gen 3 devices are controlled using WebSocket.
- The Matter device takes the name configured in the Shelly device's web page.
- A 10-minute timer checks if the device has reported in that time.

## Prerequisites

### Matterbridge

Follow these steps to install or update Matterbridge if it is not already installed and up to date:

on Windows:

```
npm install -g matterbridge
```

on Linux (you need the necessary permissions):

```
sudo npm install -g matterbridge
```

See the complete guidelines on [Matterbridge](https://github.com/Luligu/matterbridge/blob/main/README.md) for more information.

### Any shelly device

A working shelly device gen. 1 or 2 or 3.

For Gen. 1 devices:

- CoIoT: the CoIoT (coap) service must be enabled in the settings of the device and the CoIoT peer must be mcast. If mcast is not working on your network put in the peer field the Matterbridge ipv4Address and port 5683 (e.g. 192.168.1.100:5683). Multicast may not work for all networks due to router or access poit configuration or network topology (I cannot help you on this, just check your router or access point configuration). If CoIoT is not configured correctly you will not receive any update from the device.

## How to install

On windows:

```
cd $HOME\Matterbridge
npm install -g matterbridge-shelly
matterbridge -add matterbridge-shelly
```

On linux:

```
cd ~/Matterbridge
sudo npm install -g matterbridge-shelly
matterbridge -add matterbridge-shelly
```

Then start Matterbridge

```
matterbridge -bridge
```

## How to use it

You may need to set some config values:

### username

If your devices are password protected put there the username. It must be unique for all the devices.
Is only used for gen 1 devices. Gen 2 and 3 devices have always admin.

### password

If your devices are password protected put there the password. It must be unique for all the devices.

### whiteList

If the whiteList is defined only the devices included in the list are exposed to Matter.

### blackList

If the blackList is defined the devices included in the list will not be exposed to Matter.

### deviceIp

You can put there one of more of your devices if they have problem with mdns (don't use it unless is needed).
E.g. "shelly1minig3-543204547478": "192.168.1.221"

### enableMdnsDiscover

Should always be enabled to discover new devices. It turn off automatically after 10 minutes to reduce network traffic.
Once a device is discovered, it is added to the shelly storage.

### enableStorageDiscover

Should always be enabled to automatically add all the devices already discovered.

### enableConfigDiscover

Should be enabled only if the mdns is not working. It adds the devices defined in deviceIp.

### debug

Should be enabled only if you want to debug some issue in the log.

If any device creates issues put it in the blackList.

These are the config values:

```
{
  "name": "matterbridge-shelly",
  "type": "DynamicPlatform",
  "username": "<USERNAME>",
  "password": "<PASSWORD>",
  "blackList": [],
  "whiteList": [],
  "deviceIp": {
    "<DEVICENAME1>": x.x.x.x,
    "<DEVICENAME2>": x.x.x.x
  }
  "enableMdnsDiscover": false,
  "enableStorageDiscover": true,
  "enableConfigDiscover": false,
  "debug": false
  "unregisterOnShutdown": false,
}
```

You can edit the config file from the frontend (best option) or

On windows:

```
cd $HOME\.matterbridge
notepad matterbridge-somfy-tahoma.config.json
```

On linux:

```
cd ~/.matterbridge
nano matterbridge-somfy-tahoma.config.json
```

Restart Matterbridge for the changes to take effect.
