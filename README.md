# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge shelly plugin &nbsp;&nbsp; <img src="https://github.com/Luligu/matterbridge/blob/main/screenshot/Shelly.png" alt="Shelly logo" width="200" />

[![npm version](https://img.shields.io/npm/v/matterbridge-shelly.svg)](https://www.npmjs.com/package/matterbridge-shelly)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-shelly.svg)](https://www.npmjs.com/package/matterbridge-shelly)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-shelly/actions/workflows/build-matterbridge-plugin.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

This plugin allows you to expose all Shelly Gen 1, Gen 2, Gen 3 and BLU devices to Matter.

Features:

- Shellies are automatically discovered using mDNS.
- Shelly wifi battery-powered devices are supported.
- Shelly wifi battery-powered devices with sleep_mode are supported.
- Shelly BLU devices are supported through local devices configured as ble gateway.
- Discovered shellies are stored in local storage for quick loading on startup.
- The components exposed are Light (with brightness and RGB color), Switch, Relay, Roller, Cover, PowerMeter, Temperature, Humidity, Illuminance, Thermostat and Input.
- PowerMeters expose the electrical measurements with the EveHistory cluster (displayed only in Home Assistant), waiting for the controllers to upgrade to the Matter 1.3 specs.
- Shellies are controlled locally, eliminating the need for cloud or MQTT (which can both be disabled).
- Shelly Gen 1 devices are controlled using the CoIoT protocol (see the note below).
- Shelly Gen 2 and Gen 3 devices are controlled using WebSocket.
- The Matter device takes the name configured in the Shelly device's web page.
- If the device has a firmware update available, a message is displayed.
- If the device's CoIoT protocol is not correctly configured, a message is displayed.
- If the device cover/roller component is not calibrated, a message is displayed.
- If a device changes its ip address on the network, a message is displayed and the new address is stored.
- A 10-minute timer checks if the device has reported within that time frame, and fetch un update.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-shelly and sponsoring it.

## Sponsor

This project is proudly sponsored by:

<a href="https://www.shelly.com/en">
  <img src="https://github.com/Luligu/matterbridge/blob/main/screenshot/Shelly.png" alt="Shelly logo" width="100" />
</a>

[Shelly Group](https://corporate.shelly.com/about-shelly-group/)

## Acknowledgements

I would like to express my appreciation to [Tamer Salah](https://github.com/tammeryousef1006) for his invaluable contribution to this project. His expertise and assistance have been instrumental in its success. You can sponsor Tamer here https://buymeacoffee.com/6sjde6vkzl.

## Prerequisites

### Matterbridge

Follow these steps to install or update Matterbridge if it is not already installed and up to date:

```
npm install -g matterbridge --omit=dev
```

on Linux you may need the necessary permissions:

```
sudo npm install -g matterbridge --omit=dev
```

See the complete guidelines on [Matterbridge](https://github.com/Luligu/matterbridge/blob/main/README.md) for more information.

### Any shelly device

A shelly device gen. 1 or 2 or 3 or BLU.

## How to add a device

Verify that enableMdnsDiscover and enableStorageDiscover are selected in the plugin configuration. Restart matterbridge (the mdns discovery is active for the first 10 minutes) and the devices will be discovered.

Follow these guidelines for specific devices.

### Add Gen. 1 devices

- CoIoT: the CoIoT (coap) service must be enabled in the settings of the device and the CoIoT peer must be mcast. If mcast is not working on your network put in the peer field `<matterbridge-ipv4>:5683` (where `<matterbridge-ipv4>` is the ipv4 address of Matterbridge e.g. 192.168.1.100:5683). You can find the matterbridge ipv4Address address in the frontend or in the log. Multicast may not work for all networks due to router or access poit configuration or network topology (I cannot help you on this, just check your router or access point configuration). If CoIoT is not configured correctly you will not receive any update from the device.

### Add Gen. 1 battery-powered devices

- only for the first time, when you want to register them: check that enableMdnsDiscover and enableStorageDiscover are flagged in the plugin configuration. Restart matterbridge (the mdns discovery is active for the first 10 minutes) and awake each device you want to register pressing the device button.

### Add Gen. 2 or 3 battery-powered devices

- in the device web page go to "Settings", then "Outbound websocket" and enable it, select "TLS no validation" and put in the server field `ws://<matterbridge-ipv4>:8485` (where `<matterbridge-ipv4>` is the ipv4 address of Matterbridge e.g. ws://192.168.1.100:8485). You can find the matterbridge ipv4Address address in the frontend or in the log. Then, only for the first time, when you want to register them: check that enableMdnsDiscover and enableStorageDiscover are flagged in the plugin configuration. Restart matterbridge (the mdns discovery is active for the first 10 minutes) and awake each device you want to register pressing the device button.

### Add BLU devices

- BLU devices are supported through a local Shelly device acting as a ble gateway. To enable this feature, choose one or more devices that have the ble component and support the ble gateway (e.g. PRO and gen. 3 devices). In the gateway device web page, enable both "Enable Bluetooth" and "Enable Bluetooth gateway". Then, go to the "Components" section and add your BLU devices in "Bluetooth (BTHome) devices". Give a meaningful name to your device if desired and restart Matterbridge.
  See the full guide here: https://github.com/Luligu/matterbridge-shelly/blob/dev/BLU.md

## How to install the plugin

### With the frontend (preferred method)

Just open the frontend, select the matterbridge-shelly plugin and click on install. If you are using Matterbridge with Docker (I suggest you do it), all plugins are already loaded in the container so you just need to select and add it.

### Without the frontend

On windows:

```
cd $HOME\Matterbridge
npm install -g matterbridge-shelly --omit=dev
matterbridge -add matterbridge-shelly
```

On linux:

```
cd ~/Matterbridge
sudo npm install -g matterbridge-shelly --omit=dev
matterbridge -add matterbridge-shelly
```

Then start Matterbridge from a terminal

```
matterbridge
```

## How to use it

You may need to set some config values in the frontend (wait that the plugin has been configured before changing the config):

### username

If your devices are password protected put there the username. It must be unique for all the devices.
It is only used for gen 1 devices. Gen 2 and 3 devices have always admin.

### password

If your devices are password protected put there the password. It must be unique for all the devices.

### exposeSwitch

Choose how to expose the shelly switches: as a switch (don't use it with Alexa), light or outlet.
You can then configure one or more devices to be exposed differently. See the switchList, lightList and outletList.

### switchList

The devices in the list will be exposed as switches, regardless of the main option "exposeSwitch".

### lightList

The devices in the list will be exposed as lights, regardless of the main option "exposeSwitch".

### outletList

The devices in the list will be exposed as outlets, regardless of the main option "exposeSwitch".

### exposeInput

Choose how to expose the shelly inputs: disabled, contact, momentary or latching switch (default disabled)

### inputContactList

The devices in the list will expose the Input event component as a contact sensor, regardless of the main option (you can disable the Input component globally and enable it only for single devices).

### inputMomentaryList

The devices in the list will expose the Input event component as a momentary switch, regardless of the main option (you can disable the Input component globally and enable it only for single devices).

### inputLatchingList

The devices in the list will expose the Input event component as a latching switch, regardless of the main option (you can disable the Input component globally and enable it only for single devices).

### exposeInputEvent

Choose how to expose the shelly input events: momentary switch or disabled (default disabled)

### inputEventList

The devices in the list will expose the Input event component as a momentary switch, regardless of the main option (you can disable the Input event component globally and enable it only for single devices).

### exposePowerMeter

Choose how to expose the shelly power meters: disabled, matter13 (it uses Matter 1.3 electricalSensor device type that is supported by only by Home Assistant so far).

### blackList

If the blackList is defined the devices included in the list will not be exposed to Matter. Use the device id (e.g. shellyplus2pm-5443B23D81F8)

### whiteList

If the whiteList is defined only the devices included in the list are exposed to Matter. Use the device id (e.g. shellyplus2pm-5443B23D81F8).

### nocacheList

The devices in the list will not be loaded from the cache. Use the device id (e.g. shellyplus2pm-5443B23D81F8). This is usefull and necessary if you change the the device configuration from the device web ui of from the Shelly app (e.g. changing from color to white or from switch to cover or adding other BLU devices to a ble gateway). In this case put the device id in the list and restart.

### deviceIp

You can put there one of more of your devices if they have problem with mdns (don't use it unless is needed).
E.g. "shelly1minig3-543204547478": "192.168.1.221"

### enableMdnsDiscover

Should always be enabled to discover new devices. It turns off automatically after 10 minutes to reduce network traffic.
Once a device is discovered, it is added to the shelly storage.

### enableStorageDiscover

Should always be enabled to automatically add all the devices previously discovered.

### resetStorageDiscover

Reset the storage discovery on the next restart (it will clear the storage of already discovered devices and the cache files).

### enableConfigDiscover

Should be enabled only if the mdns is not working in your network. It adds the devices defined in deviceIp.

### enableBleDiscover

Should be enabled to discover the shelly BLU devices (it will register the BLU devices paired in each ble gateway, see https://github.com/Luligu/matterbridge-shelly/blob/dev/BLU.md for more informations).

### failsafeCount

Enable the failsafe count of the devices registered. If the plugin registers less devices then the configured number, the plugin will go in error mode. This is to avoid to loose the controller configuration in case of network issues (default 0 = disabled).

### postfix

Add this unique postfix (3 characters max) to each device serial to avoid collision with other instances (you may loose the configuration of the devices in your controller when changing this value or you may need to pair again the controller).

### debug

Should be enabled only if you want to debug some issue using the log.

### debugMdns

Should be enabled only if you want to debug some issue with mdns using the log.

### debugCoap

Should be enabled only if you want to debug some issue with CoIoT using the log.

### debugWs

Should be enabled only if you want to debug some issue with the WebSocket client or server using the log.

### unregisterOnShutdown

Should be enabled only if you want to remove the devices from the controllers on shutdown.

### Config file

These are the config values:

```
{
  "name": "matterbridge-shelly",
  "type": "DynamicPlatform",
  "username": "<USERNAME>",
  "password": "<PASSWORD>",
  "exposeSwitch": "switch" | "light" | "outlet"
  "switchList": []
  "lightList": []
  "outletList": []
  "exposeInput": "disabled" | "contact" | "momentary" | "latching"
  "inputContactList": []
  "inputMomentaryList": []
  "inputLatchingList": []
  "exposeInputEvent": "disabled" | "momentary"
  "inputEventList": []
  "exposePowerMeter": "disabled" | "matter13"
  "blackList": [],
  "whiteList": [],
  "nocacheList": [],
  "deviceIp": {
    "<DEVICEID1>": "x.x.x.x",
    "<DEVICEID2>": "x.x.x.x"
  },
  "enableMdnsDiscover": true,
  "enableStorageDiscover": true,
  "resetStorageDiscover": false
  "enableConfigDiscover": false,
  "enableBleDiscover": true,
  "failsafeCount": 0,
  "postfix": ""
  "debug": false,
  "debugMdns": false,
  "debugCoap": false,
  "debugWs": false,
  "interfaceName": ""
  "unregisterOnShutdown": false,
}
```

You can edit the config file from the frontend (best option) or

On windows:

```
cd $HOME\.matterbridge
notepad matterbridge-shelly.config.json
```

On linux:

```
cd ~/.matterbridge
nano matterbridge-shelly.config.json
```

Restart Matterbridge for the changes to take effect.
