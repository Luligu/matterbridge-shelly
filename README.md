# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge shelly plugin &nbsp;&nbsp; <img src="https://matterbridge.io/assets/Shelly.svg" alt="Shelly logo" width="200" />

[![npm version](https://img.shields.io/npm/v/matterbridge-shelly.svg)](https://www.npmjs.com/package/matterbridge-shelly)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-shelly.svg)](https://www.npmjs.com/package/matterbridge-shelly)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-shelly/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge-shelly/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge-shelly/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge-shelly)
[![styled with prettier](https://img.shields.io/badge/styled_with-Prettier-f8bc45.svg?logo=prettier)](https://github.com/prettier/prettier)
[![linted with eslint](https://img.shields.io/badge/linted_with-ES_Lint-4B32C3.svg?logo=eslint)](https://github.com/eslint/eslint)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/api/esm.html)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)

[![powered by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

This plugin allows you to expose all Shelly Gen 1, Gen 2, Gen 3, Gen 4 and BLU devices to Matter.

Features:

- Shellies are automatically discovered using mDNS.
- Shelly wifi battery-powered devices are supported.
- Shelly wifi battery-powered devices with sleep_mode are supported. If they don't report in the last 24h, they are considered offline.
- Shelly BLU devices are supported through local devices configured as ble gateway.
- Discovered shellies are stored in local storage and cached for fast loading on startup.
- The components exposed are Light (with brightness and RGB color), Switch, Relay, Roller, Cover, PowerMeter, Temperature, Humidity, Illuminance, Thermostat, Button and Input.
- PowerMeters expose the electrical measurements with the electricalSensor device type (supported by Home Assistant and partially by SmartThings), waiting for the other controllers to upgrade to the Matter 1.3 specs.
- Shellies are controlled locally, eliminating the need for cloud or MQTT (which can both be disabled).
- Shelly Gen 1 devices are controlled using the CoIoT protocol (see the note below).
- Shelly Gen 2, Gen 3 and Gen 4 devices are controlled using WebSocket.
- The Matter device takes the name configured in the Shelly device's web page (each Shelly device must have a different name).
- Each device can be excluded or included using its name, id or mac address. Refer to the [COMPONENTS.md documentation.](https://github.com/Luligu/matterbridge-shelly/blob/main/COMPONENTS.md)
- Device components can be blacklisted globally or on a per-device basis. Refer to the [COMPONENTS.md documentation.](https://github.com/Luligu/matterbridge-shelly/blob/main/COMPONENTS.md)
- Devices ids can be selected from a list in the config editor or in the Devices panel on the Home page.
- If the device has a firmware update available, a message is displayed.
- If the device's CoIoT protocol is not correctly configured for the gen 1 devices, a message is displayed.
- If the device's Outbound websocket settings is not correctly configured for the gen 2+ battery powered devices, a message is displayed.
- If the device cover/roller component is not calibrated, a message is displayed.
- If a device changes its ip address on the network, a message is displayed and the new address is stored.
- A 1 hour timer checks if the device has reported within that time frame, fetch an update and save the cache file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-shelly and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120">
</a>

## Sponsors

This project is proudly sponsored by:

<a href="https://www.shelly.com/en">
  <img src="https://matterbridge.io/assets/Shelly.svg" alt="Shelly logo" width="100" />
</a>

[Shelly Group](https://corporate.shelly.com/about-shelly-group/)

## Acknowledgements

I would like to express my appreciation to [Tamer Salah](https://github.com/tammeryousef1006) for his invaluable contribution to this project. His expertise and assistance have been instrumental in its success. You can sponsor Tamer here https://buymeacoffee.com/6sjde6vkzl.

## Prerequisites

### Matterbridge

See the complete guidelines on [Matterbridge](https://matterbridge.io) for more information.

### Any shelly device

A shelly device gen. 1 or 2 or 3 or 4 or BLU.

## How to add a device

Verify that enableMdnsDiscover and enableStorageDiscover are selected in the plugin configuration. Restart matterbridge in case these options were not flagged and the devices will be discovered.

When all the devices have been discovered and stored, I suggest to unselect enableMdnsDiscover.

Follow these guidelines for specific devices.

### Add Gen. 1 devices

- CoIoT: the CoIoT (coap) service must be enabled in the settings of the device and the CoIoT peer must be mcast. If mcast is not working on your network put in the peer field `<matterbridge-ipv4>:5683` (where `<matterbridge-ipv4>` is the ipv4 address of Matterbridge e.g. 192.168.1.100:5683). You can find the matterbridge ipv4Address address in the frontend or in the log. Multicast may not work for all networks due to router or access point configuration or network topology (I cannot help you on this, just check your router or access point configuration). If CoIoT is not configured correctly you will not receive any update from the device.

### Add Gen. 1 battery-powered devices

- First check that enableMdnsDiscover and enableStorageDiscover are flagged in the plugin configuration. If they are not, enable them and restart matterbridge. Then awake the device you want to register pressing the device button. It is also possible, when CoIoT is correctly configured, to just wait for the device to awake and it will be registered automatically.

### Add Gen. 2 or 3 battery-powered devices

- First check that enableMdnsDiscover and enableStorageDiscover are flagged in the plugin configuration. If they are not, enable them and restart matterbridge. Then awake the device you want to register pressing the device button and in the device web page go to "Settings", then "Outbound websocket" and enable it, select "TLS no validation" and put in the server field `ws://<matterbridge-ipv4>:8485` (where `<matterbridge-ipv4>` is the ipv4 address of Matterbridge e.g. ws://192.168.1.100:8485). You can find the matterbridge ipv4Address address in the frontend or in the log. It is also possible, when "Outbound websocket" is configured correctly, to just wait for the device to awake and it will be registered automatically.

### Add Gen. 4 devices

- Matter: the integrated Matter component should be disabled to save network bandwidth and device resources (memory and energy consumption). Gen 4 devices are supported like any other Shelly device. The Matter component serves no purpose when you add them to Matterbridge.

### Add BLU devices

- BLU devices are supported through a local Shelly device acting as a ble gateway. To enable this feature, choose one or more devices that have the ble component and support the ble gateway (e.g. PRO, Gen 3 and Gen 4 devices). In the gateway device web page, enable both "Enable Bluetooth" and "Enable Bluetooth gateway" or "Enable RPC". Then, go to the "Components" section and add your BLU devices in "Bluetooth (BTHome) devices". Give a meaningful name to your device if desired and restart Matterbridge. See the full guide here: https://github.com/Luligu/matterbridge-shelly/blob/dev/BLU.md

## How to make the device IP address stable

There are two ways to have the wifi device IP stable:

1. In your router configuration find, in the DHCP settings, the option to reserve an ip address for all your shelly wifi devices.
2. In the device web UI (or Shelly app) go to Settings / WiFi and set a static IP for Wi-Fi 1 settings.

A stable IP address is mandatory for battery powered devices. I suggest to set it for all the other devices too.

## How to install the plugin

### With the frontend (preferred method)

Just open the frontend, select the matterbridge-shelly plugin and click on install. If you are using Matterbridge with Docker (I suggest you do it), all plugins are already loaded in the container image so you just need to select and add it.

### Without the frontend

On windows:

```shell
cd $HOME\Matterbridge
npm install -g matterbridge-shelly --omit=dev
matterbridge -add matterbridge-shelly
```

On linux:

```shell
cd ~/Matterbridge
sudo npm install -g matterbridge-shelly --omit=dev
matterbridge -add matterbridge-shelly
```

Then start Matterbridge from a terminal

```shell
matterbridge
```

## How to use it

You may need to set some config values in the frontend.

Changing configuration after the controller is already paired may cause the controller to see the device as new devices and reset their configuration. You may need to wait a few minutes that the controller reads again all endpoints.

Wait that the plugin has been configured before changing the config.

### username

If your devices are password protected put here the username. It must be unique for all the devices.

It is only used for gen 1 devices. Gen 2 and 3 devices have always admin.

### password

If your devices are password protected put here the password. It must be unique for all the devices.

### switchList

The devices in the list will be exposed as switches (don't use it for Alexa).

### lightList

The devices in the list will be exposed as lights.

### inputContactList

The devices in the list will expose the Input component as a contact sensor.

### inputMomentaryList

The devices in the list will expose the Input component as a momentary switch.

In Matter a momentary switch is button that can be pressed or released.

### inputLatchingList

The devices in the list will expose the Input component as a latching switch (latching switches are not supported by all controllers).

In Matter a latching switch is a switch that keeps its position open or closed.

### blackList

If the blackList is defined the devices included in the list will not be exposed to Matter.

For shelly wifi devices use the device name (i.e. the name defined in the device web UI), the device id (i.e. shellyplus2pm-5443B23D81F8) or the device mac (i.e. 5443B23D81F8).

For shelly BLU devices use the device name (i.e. the name defined in the device gateway web UI) or the device mac addr (i.e. 7c:c6:b6:65:2d:87).

### whiteList

If the whiteList is defined only the devices included in the list are exposed to Matter.

For shelly wifi devices use the device name (i.e. the name defined in the device web UI), the device id (i.e. shellyplus2pm-5443B23D81F8) or the device mac (i.e. 5443B23D81F8).

For shelly BLU devices use the device name (i.e. the name defined in the device gateway web UI) or the device mac addr (i.e. 7c:c6:b6:65:2d:87).

### entityBlackList

The components in the list will not be exposed for all devices. Use the component name (i.e. Temperature).

For detailed examples, refer to the [COMPONENTS.md documentation.](https://github.com/Luligu/matterbridge-shelly/blob/main/COMPONENTS.md)

### deviceEntityBlackList

The deviceEntityBlackList is a list of components that should not be exposed for a specific device.

In the first field, enter the device ID (e.g., shellyplus2pm-5443B23D81F8 for Wi-Fi Shelly devices or 7c:c6:b6:65:2d:87 for BLU Shelly devices).
In the second field, list all the component names (e.g., Temperature) or component IDs (e.g., temperature:0) you want to exclude for that device.

For detailed examples, refer to the [COMPONENTS.md documentation.](https://github.com/Luligu/matterbridge-shelly/blob/main/COMPONENTS.md)

### nocacheList

The devices in the list will not be loaded from the cache. Use the device id (e.g. shellyplus2pm-5443B23D81F8). This is only usefull if you change the device configuration from the device web ui or from the Shelly app (e.g. changing from color to white or from switch to cover or adding other BLU devices to a ble gateway) and don't want to wait the plugin to detect the change. In this case put the device id in the list and restart.

### deviceIp

You can put there one of more of your devices if they have problem with mdns.
Don't use it unless is needed cause the IP address you add here is static.
Don't use it for battery powered device that go in sleepmode.
You also need to enable the enableConfigDiscover option.
E.g. "shelly1minig3-543204547478": "192.168.1.221".

### enableMdnsDiscover

Should always be enabled to discover new devices.

Once a device is discovered, it is added to the shelly storage.

Once all the devices are loaded and stored, it is possible to disable this setting to reduce the network traffic.

### enableStorageDiscover

Should always be enabled to automatically add all the devices previously discovered.

### resetStorageDiscover

Reset the storage on the next restart (it will clear the storage and the cache files).

### enableConfigDiscover

Should be enabled only if the mdns is not working in your network. It adds the devices defined in deviceIp.

Once all the devices are loaded and stored, disable this setting.

### enableBleDiscover

Should be enabled to discover the shelly BLU devices (it will register the BLU devices paired in each ble gateway, see https://github.com/Luligu/matterbridge-shelly/blob/dev/BLU.md for more informations).

### failsafeCount

Enable the failsafe count of the devices registered. If the plugin registers less devices then the configured number, the plugin will go in error mode. This is to avoid to lose the controller configuration in case of network issues (default 0 = disabled).

### postfix

Add this unique postfix (3 characters max) to each device serial to avoid collision with other instances (you may loose the configuration of the devices in your controller when changing this value or you may need to pair again the controller). Unless you have a complex setup with more then one controller and different instances of Matterbridge, don't use it.

### debug

Should be enabled only if you want to debug some issue using the log. Only for development.

### debugMdns

Should be enabled only if you want to debug some issue with mdns using the log. Only for development.

### debugCoap

Should be enabled only if you want to debug some issue with CoIoT using the log. Only for development.

### debugWs

Should be enabled only if you want to debug some issue with the WebSocket client or server using the log. Only for development.

### unregisterOnShutdown

Should be enabled only if you want to remove the devices from the controllers on shutdown. Only for development.

### Config file

These are the config values:

```json
{
  "name": "matterbridge-shelly",
  "type": "DynamicPlatform",
  "username": "<USERNAME>",
  "password": "<PASSWORD>",
  "switchList": [],
  "lightList": [],
  "inputContactList": [],
  "inputMomentaryList": [],
  "inputLatchingList": [],
  "blackList": [],
  "whiteList": [],
  "entityBlackList": [],
  "deviceEntityBlackList": {},
  "nocacheList": [],
  "deviceIp": {
    "<DEVICEID1>": "x.x.x.x",
    "<DEVICEID2>": "x.x.x.x"
  },
  "enableMdnsDiscover": true,
  "enableStorageDiscover": true,
  "resetStorageDiscover": false,
  "enableConfigDiscover": false,
  "enableBleDiscover": true,
  "failsafeCount": 0,
  "postfix": "",
  "debug": false,
  "debugMdns": false,
  "debugCoap": false,
  "debugWs": false,
  "unregisterOnShutdown": false,
}
```

You can edit the config file from the frontend (best option) or

On windows:

```shell
cd $HOME\.matterbridge
notepad matterbridge-shelly.config.json
```

On linux:

```shell
cd ~/.matterbridge
nano matterbridge-shelly.config.json
```

Restart Matterbridge for the changes to take effect.
