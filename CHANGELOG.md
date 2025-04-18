# <img src="matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge shelly plugin changelog

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-shelly and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="120">
</a>

You can also sponsor Tamer here https://buymeacoffee.com/6sjde6vkzl for his invaluable contribution to this project.

### Breaking Changes

New setups:

- these components are blacklisted (with entityBlackList) by default: "Lux", "Illuminance", "Vibration", "Button". This allows to create simplified devices for the controllers that don't manage correctly composed devices (i.e. Alexa and SmartThings).
- all switches are exposed like outlet (matter compliant).
- shellyplusi4, shellyi4g3, shellyix3 and shellybutton1 are automatically added to inputMomentaryList when discovered.
- expertMode is disabled (the config shows only username, password, whitelist and blackList).

New device types:

- shellyflood device type has been updated from contact sensor to water leak sensor.
- shellysmoke device type has been updated from contact sensor to smoke sensor.

If your controller has issues detecting the new device type, blacklist the flood and smoke devices, restart, remove the blacklist and restarat again. This will create a new endpoint on the controller.
For shellyflood, if you have SmartThings, blacklist the Temperature entity for each flood device with deviceEntityBlackList to allow the controller to setup the correct driver.

## [2.0.7] - 2025-04-13

### Added

- [shelly]: Added more information on the log for disconnection events.
- [ShellyWsClient]: Added immediate offline event in case of WebSocketClient errors.

### Changed

- [package]: Updated dependencies.
- [shellyflood]: Updated the device type from contact sensor to water leak sensor.
- [shellysmoke]: Updated the device type from contact sensor to smoke sensor.

### Fixed

- [restart]: Fixed case when device with sleep mode send config changed.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.0.6] - 2025-04-02

### Added

- [Gen4]: Added support for Gen4 devices.
- [SHTRV-01]: Added support for Shelly TRV Gen1 (SHTRV-01). Thanks https://github.com/vandan380.
- [SHRGBWW-01]: Added support for Shelly RGBW1 Gen1 (SHRGBWW-01). Thanks D.D.
- [Shelly]: Optimized Shelly class Jest test.
- [CoIoT]: Optimized /cit/d request using http instead of coap. Thanks D.D.

### Changed

- [package]: Updated package.
- [package]: Updated dependencies.

### Fixed

- [battery]: Fixed voltage reading for Gen1 battery powered devices.
- [configUrl]: When a device IP change is detected, the configUrl is updated too.
- [CoIoT]: Fixed wrong error message for the first generation of Gen 1 device that don't have peer and enable in the CoIoT component. Thanks D.D.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.0.5] - 2025-03-19

### Added

- [config] Added config action: manually add a device with IP address. It allows to add the devices that are not discovered on the network with the mdns.
- [config] Added config action: remove a device from the storage with its device id. It allows to remove from the storage a single device when it has been removed from the network.
- [config] Added config action: scan network. It will send a mdns request on the network.
- [mdns] Added a fully automatic IP change detection when the device is discovered on a different IP (no need to restart).
- [shelly] Verified AZ Plug Gen3.
- [shelly] Verified PlugSG3 Matter Gen3.
- [BLU]: Verified new BLU firmware 1.0.22 on all BLU devices.
- [TRV]: Verified new BLU TRV firmware 1.2.1.

### Removed

- [fetch]: Removed node-fetch package and use the global fetch.

### Changed

- [config] Removed enableConfigDiscover and deviceIp. Replaced by a config action (manually add a device with IP address).
- [package]: Updated package.
- [package]: Updated dependencies.
- [plugin]: Requires Matterbridge 2.2.5.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.0.4] - 2025-03-13

### Added

- [MdnsScanner]: Refactor Jest test to include all gen 1, 2, 3 and 4 devices mdns responses (gen 4 are still not supported and blocked).
- [CoapServer]: CoapServer v. 2.0.0.
- [WsServer]: WsServer v. 1.3.1.
- [WsClient]: WsClient v. 2.0.2.
- [Shelly]: Shelly v. 2.2.0.
- [ShellyDevice]: ShellyDevice v. 3.1.0
- [shelly]: Refactor fetchInterval logic to reduce cpu load and network traffic on the board in the first 5 minutes from start.
- [shelly]: Added check of ws component configuration for gen 2+ battery powered device (i.e. shellyhtg3).
- [shelly]: Optimized state updates for gen 1 and gen 2+ devices.

### Changed

- [CoapServer]: Removed log of error message for shellymotionsensor and shellymotion2 that don't answer to the /cit/s and /cit/d CoIoT requests.
- [package]: Updated package.
- [package]: Updated dependencies.
- [plugin]: Requires Matterbridge 2.2.4.

### Fixed

- [platform]: Fixed initial values of battery component.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.0.3] - 2025-03-05

### Added

- [MdnsScanner]: Added discovery of gen 4 devices.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.0.2] - 2025-03-05

### Changed

- [package]: Updated dependencies.

### Fixed

- [platform]: Fixed edge case for select and unselect.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.0.1] - 2025-03-02

### Changed

- [blugateway]: The BLU gateways can now be disabled (with whiteList or blackList). The paired BLU devices are exposed even if the gateway is disabled.
- [mDns]: The MdnsScanner doesn't stop anymore after 10 minutes. Once all the devices have been discovered, it is possible to disable it in the config to reduce the network traffic.
- [platform]: Refactor select devices and entities for the select in the frontend.
- [package]: Updated dependencies.
- [plugin]: Requires Matterbridge 2.2.1.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.0.0] - 2025-02-27

### Added

- [platform]: Optimized memory and memory release.
- [shelly]: Optimized memory and memory release.
- [shelly]: Added online offline status on matter.
- [BLU]: Verified firmware 1.0.21.
- [TRV]: Verified firmware 1.2.0.
- [WIFI]: Verified firmware 1.5.0.

### Changed

- [package]: Updated package.
- [package]: Updated dependencies.
- [plugin]: Requires Matterbridge 2.2.0.

### Fixed

- [platform]: Removed coiot component from Select.
- [select]: Fix bthomesensor_event with select Button.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.1.6] - 2025-02-11

### Added

- [wsClient]: Optimized wsClient Jest test.
- [wsClient]: Optimized memory moving the PowerSource cluster to the main endpoint. The controller can see the devices as new.

### Changed

- [package]: Updated package.
- [package]: Updated dependencies.
- [plugin]: Requires Matterbridge 2.1.5.

### Fixed

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.1.5] - 2025-02-02

### Added

- [package]: Optimized imports.
- [wsClient]: Optimized wsClient and wsClient Jest test.

### Changed

- [package]: Updated package.
- [package]: Updated dependencies.
- [plugin]: Requires Matterbridge 2.1.0.

### Fixed

- [switch]: Update triggerSwitch logic for edge.
- [shellywalldisplay]: Fix NotifyEvent for "user_1".

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.1.4] - 2025-01-20

### Added

- [platform]: Refactor onStart to await device creation to address some cases where the controller reset the configuration on slow host.
- [selectDevice]: Added selectDevice to deviceIp to get the components names from a list in the config editor.
- [em1data]: Added update for total_act_energy in onConfigure.
- [package]: Requires matterbridge 1.7.3.

### Changed

- [package]: Updated dependencies.

### Fixed

- [em1data]: Fixed typo em1data.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.1.3] - 2025-01-11

### Added

- [selectDevice]: Added selectEntity to get the components names from a list in the config editor.
- [selectDevice]: Added the possibility to exclude PowerSource.
- [schema]: Configured all lists to not have duplicates.
- [package]: Requires matterbridge 1.7.2.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.1.2] - 2025-01-08

### Added

- [selectDevice]: Added selectDevice to get the device names from a list in the config editor.
- [package]: Requires matterbridge 1.7.1.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.1.1] - 2024-12-22

### Added

- [matter]: Add list generation of device types and cluster servers used in the plugin for the certification.
- [plugin]: Add the possibility to validate shelly wifi devices by name, id and mac (i.e. you can put in the blacklist and whitelist the device name given in the web UI, the shelly id or the shelly mac).
- [plugin]: Add the possibility to validate shelly BLU devices by name and mac (i.e. you can put in the blacklist and whitelist the device name given in the gateway web UI or the shelly BLU mac). If you put a shelly BLU in the white list, you need to put also his BLU gateway on the white list.
- [plugin]: Refactor child endpoint creation in ShellyPlatform to use addChildDeviceType and addRequiredClusterServers.
- [platform]: Added a check for endpoint numbers changes.
- [readme]: Update COMPONENTS.md and README.md for clarity on blacklisting components.

### Changed

- [package]: Updated dependencies.

### Fixed

- [configure]: Fixed async loop.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.1.0] - 2024-12-14

### Added

- [package]: Verified to work with matterbridge edge (matter.js new API).
- [package]: Requires matterbridge 1.6.6.
- [shelly]: Remove from discovered devices the device with mongoose firmware. We ignore them.
- [shelly]: Add shellyIdentifyCommandHandler.
- [BLU]: Add validate against white and black list for BLU devices. If you put a shelly BLU in the white list, you need to put also his BLU gateway on the white list.
- [BLU]: Add global and single device component black list. You can now exclude a shelly component globally or on a device base (available also for BLU devices).
- [matter]: Add tagList to the descriptor cluster.

### Changed

- [shelly]: Refactor shellySwitchCommandHandler.
- [shelly]: Refactor shellyLightCommandHandler.
- [shelly]: Refactor shellyCoverCommandHandler.
- [colorControl]: Refactor configuration of the cluster.
- [electricalSensor]: Refactor electrical measurements initial configuration.
- [matter]: Update all device types.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.11] - 2024-12-04

### Added

- [Jest]: Jest coverage 100% on shellyProperty
- [Jest]: Jest coverage 100% on shellyComponent
- [shelly]: Verified support for shelly2pmg3 (Shelly 2PM Gen 3) mode cover with firmware 1.4.99-2pmg3prod0-ge3db05c.
- [shelly]: The cache file is saved for all sleepy devices when they wake up.
- [Jest]: Jest test on shelly2pmg3 mode cover (mock and real)

### Changed

- [package]: Requires matterbridge 1.6.5.
- [package]: Updated dependencies.
- [platform]: The ShellyPlatform class has grown too much: moved the shellySwitchCommandHandler, shellyLightCommandHandler, shellyCoverCommandHandler and shellyUpdateHandler methods to separate files.
- [platform]: Refactor Matter Thermostat component for WallDisplay
- [platform]: Refactor Matter Thermostat component for BLU Trv
- [levelControl]: Fix max level to 254.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.10] - 2024-11-21

### Added

- [edge]: Preliminary updates to support Matterbridge edge (matter.js new API).
- [Jest]: Refactor Jest real tests for Gen3 devices
- [Jest]: Refactor Jest mock tests for Gen3 devices
- [Jest]: Added Jest mock tests for shellyswitch25 switch and cover mode

### Changed

- [ShellyCommandHandler]: Refactor shellyCommandHandlers.
- [BTHome]: Update scanBTHomeComponents to the new BLU firmware 1.0.20 (model identification changes from v1.0.18).
- [log]: Show username and password with \*\*\*\* in logs.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.9] - 2024-11-11

### Added

- [shelly1]: Added support (with 1 temperature and 1 humidity) for external temperature and humidity addon (thanks IvoGruber).
- [ShellyPlusAddon]: Verified support with sensor temperature DS18B20.
- [ShellyPlusAddon]: Verified support with sensor temperature and humidity DHT22.
- [shelly]: Added change of device IP address without restart when mDns detect new IP.
- [CoIoT]: Added cfgChanged event.

### Changed

- [log]: Changed level for CoIoT configuration messages from notice to warn.
- [package]: Requires matterbridge 1.6.0.
- [package]: Updated dependencies.

### Fixed

- [BTHome]: Fixed log level for BLU devices.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.8] - 2024-10-23

### Fixed

- [BTHome]: Fixed issue to BTHome components discovery.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.7] - 2024-10-23

### Added

- [shelly]: Added both mode HueAndSaturation and ColorTemp to Shelly Bulb (SHCB-1) with switching between color and white mode.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.6] - 2024-10-21

### Changed

- [package]: Updated package.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.5] - 2024-10-21

### Added

- [shelly]: Verified support for shellyhtg3 (Shelly H&T Gen 3) with new firmware 1.4.5-gbf870ca.
- [shelly]: Added event awake to save sleepy device cache file.
- [shelly]: Added scheduled_restart event from Sys to set the devices that will not be loaded from cache at restart.
- [shelly]: Added config_changed event from Sys to set the devices that will not be loaded from cache at restart.
- [shelly]: Added ota_begin, ota_progress and ota_success events from Sys to set the devices that will not be loaded from cache at restart.
- [shelly]: Added ColorTemp to Shelly Duo and Shelly Bulb in white mode.
- [cockpit]: Added cockpit dashboard 1.0

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.4] - 2024-10-17

### Added

- [shelly]: Added support for shellyht (Shelly H&T Gen 1) with firmware v1.14.0-gcb84623 and added Jest test (components: Temperature, Humidity and Battery). Verified and tested by Tamer.
- [shelly]: Added mdns Jest test for shellyht (Shelly H&T Gen 1) with firmware v1.14.0-gcb84623.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.3] - 2024-10-15

### Added

- [shelly]: Verified support for blutrv with new firmware 20241011-050134/v1.0.1@ed260994.

### Changed

- [plugin]: Changed required version of matterbridge to 1.5.9.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.2] - 2024-10-13

### Added

- [shelly]: Added scheduled_restart event from Sys to set the devices that will not be loaded from cache at restart.
- [shelly]: Added component Devicepower.
- [shellyplussmoke]: Added battery readings (battery level and voltage) to shellyplussmoke and shellyhtg3 (all devices with Devicepower component).

### Fixed

- [BTHome]: Fixed issue to BTHome components discovery.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.1] - 2024-10-10

### Added

- [shelly]: Verified support for shellyblugwg3 (BLU Gateway Gen 3) with new firmware v1.4.99-blugwg3prod2.
- [shelly]: Verified support for blutrv with new firmware 20241004-125638/main@4b7c4712+.
- [shelly]: Added support for external sensors of blutrv.

### Fixed

- [BTHome]: Added type checking to BTHome components discovery.
- [BTHome]: Fixed the case when blutrv ids and bthomedevice ids are different in the shellyblugwg3 config.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.0.0] - 2024-10-07

There are a lot of new features in this first production release. Please take the the time to read this CHANGELOG and the README.

To allow an easy update to the new version, please after the update, restart, wait at least 15 minutes for all devices to report and save the cache file, open the config from the frontend and confirm it even if you didn't change anything and restart again.

### Added

- [shelly]: Added support for BLU Wall Switch 4.

- [shelly]: Added support for BLU RC Button 4.

- [shelly]: Added support for BLU TRV with firmware v20240926-201942.

- [shelly]: Added support for shellyblugwg3 (BLU Gateway Gen 3) with firmware v1.4.99-blugwg3prod1 and added Jest test (it exposes also "Enable LED" with the ModeSelect cluster).

- [shelly]: Added mdns Jest test for shellyblugwg3 (BLU Gateway Gen 3) with firmware v1.4.99.

- [shelly]: Verified support for shellypro2cover with firmware v1.4.2 and added Jest test. Verified and tested by Tamer.

- [shelly]: Added mdns Jest test for shellypro2cover with firmware v1.4.2.

- [shelly]: Verified support for shellyplugsg3 with firmware v1.2.3-plugsg3prod0-gec79607 and added Jest test.

- [shelly]: Added mdns Jest test for shellyplugsg3 with firmware v1.4.99.

- [shelly]: Verified support for shelly2pmg3 with firmware v1.4.99-2pmg3prod0-ge3db05c and added Jest test.

- [shelly]: Added mdns Jest test for shelly2pmg3 with firmware v1.4.99.

- [shelly]: Added component Thermostat.

- [shelly]: Added support for shellywalldisplay mode thermostat with firmware v2.2.1 and added Jest test.

- [config]: Added the "switchList", "lightList" and "outletList" to individually configure how to expose a switch, regardless of the global option.

- [config]: Added the "inputContactList" to individually configure a device to expose the Input component as contact sensor, regardless of the global option (you can disable the Input component globally and enable it only for single devices).

- [config]: Added the "inputMomentaryList" to individually configure a device to expose the Input component as momentary switch, regardless of the global option (you can disable the Input component globally and enable it only for single devices).

- [config]: Added the "inputLatchingList" to individually configure a device to expose the Input component as latching switch, regardless of the global option (you can disable the Input component globally and enable it only for single devices).

- [config]: Added the "inputEventList" to individually configure a device to expose the Input event component, regardless of the global option (you can disable the Input event component globally and enable it only for single devices).

- [config]: Removed EveHistory electrical measurements since Home Assistant supports Matter 1.3 electrical measurements from version 2024.10.

- [config]: Added the "nocacheList" to individually configure a device not to be loaded from the cache at restart. The devices "shellywalldisplay" and "shellyblugwg3" are never loaded from the cache even if they are not on the list.

- [BLU]: Added sensor data in configuration process (all states and measurements are immediately available on the controller).

### Changed

- [package]: Updated dependencies.

### Fixed

- [ShellyWsClient]: Changed message from warning to debug for unknown response.

- [shelly BLU]: Fixed bthome discover when one BLU is paired with more then one gateway.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.11.0] - 2024-10-01

### Added

- [shelly]: Added component Illuminance.
- [shelly]: Added support for shellywalldisplay with firmware v2.2.1 and added Jest test. Verified and tested by Tamer.

### Changed

- [ShellyMdnsScanner]: Refactor Jest test.
- [package]: Optimized the package for space and speed for rock-s0.
- [package]: Updated dependencies.

### Fixed

- [ShellyMdnsScanner]: Fixed name discovered for shellyplug-s
- [ShellyDevice]: Fixed normalizeId.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.10.0] - 2024-09-26

### Added

- [shelly]: Added component Gas.
- [shelly]: Added support for shellygas with firmware v1.14.0 and added Jest test. Verified and tested by Tamer.
- [shelly]: Added component Smoke.
- [shelly]: Added support for shellyplussmoke with firmware v1.4.2 and added Jest test. Verified and tested by Tamer.
- [test]: Added Jest test for ShellyWsServer
- [test]: Added Jest test for ShellyWsClient
- [test]: Added Jest test for real gen 1 devices
- [test]: Added Jest test for real gen 2 devices
- [test]: Added Jest test for real gen 3 devices
- [shelly]: Added a cache validation random interval for all not sleeping devices.

### Changed

- [shelly]: All devices are loaded from cache to speed up the loading phase in huge networks.
- [shelly]: Added electricalSensor device type to Switch, Light and Cover components when enabled (will be supported by Home Assistant v. 2024.10).
- [package]: Updated dependencies.

### Fixed

- [covery]: Fixed cover closed for gen 2 devices.
- [mdns]: Fixed gen discovery.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.10] - 2024-09-19

### Changed

- [ShellyWsClient]: Refactor wsClient to send different src client id.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.9] - 2024-09-17

### Changed

- [matterbridge]: Removed Matterbridge deprecated method to get the child endpoints.
- [package]: Updated dependencies.

### Fixed

- [shelly]: Fixed the bug in configure when postfix is used.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.8] - 2024-09-13

### Added

- [shelly]: The Input components are not added when they are not enabled in the device web page.
- [shelly]: Input components configured like Button are now supported as momentary switches if exposeInputEvent=momentary.
- [shelly]: Configure Light and Rgb components.
- [shelly]: Extended support for Matter 1.3 electrical measurement clusters (they will soon be released in Home Automation).

### Verified

- [shelly]: Verified shellyplus010v with firmware v. 1.4.2 and added Jest test.
- [shelly]: Verified shellyplusi4 (DC) with firmware v. 1.4.2 and added Jest test.

### Changed

- [package]: Updated typescript to 5.6.2.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.7] - 2024-09-09

### Added

- [config]: Added option "postfix" to postfix the matter serial number to avoid eventual collisions with other devices on the network (default empty string).
- [config]: Added option "failsafeCount" to avoid to start the bridge when some network issue prevents to load all devices (default 0 = disabled).
- [matterbridge]: Added a check of the current Matterbridge version (required v1.5.4).

### Verified

- [shelly]: Verified shellyprodm1pm with firmware v. 1.4.2 and added Jest test (this device needs to be calibrated to enable level control).
- [shelly]: Verified shelly1g3 with firmware v. 1.4.2 and added Jest test.
- [shelly]: Verified shelly1pmg3 with firmware v. 1.4.2 and added Jest test.
- [shelly]: Verified shellyi4g3 with firmware v. 1.4.2 and added Jest test.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.6] - 2024-09-06

### Verified

- [shelly]: Verified shellyplusplugs with firmware v. 1.4.2 and added Jest test.
- [shelly]: Verified shellybulbduo with firmware v. 1.14.0 and added Jest test.
- [shelly]: Verified shellycolorbulb (mode color and white) with firmware v. 1.14.0 and added Jest test.

### Fixed

- [shelly]: Fixed mode detection (color/white) for Shelly DUO RGBW.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.5] - 2024-09-04

### Added

- [package]: Update to matter.js 0.10.0

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.4] - 2024-09-03

### Added

- [package]: Added sponsor and refactor README.md
- [package]: Verified shellyrgbw2 with profile: white
- [package]: Verified effects of upgrade to matter.js 0.10.0

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.3] - 2024-08-29

### Added

- [shelly]: When an already discovered and stored device is discovered with a new address, the change is registered and takes effect after restarting.
- [shelly]: Added support for shellypro3em (monophase only).
- [shelly]: Added a guide to add and debug BLU devices https://github.com/Luligu/matterbridge-shelly/blob/dev/BLU.md.

### Fixed

- [shelly]: Fixed WindowCovering.MovementStatus for Gen. 1 rollers

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.2] - 2024-08-28

### Changed

- [package]: Updated dependencies.
- [covers]: refactor Cover and Roller components for WindowCovering cluster.

### Fixed

- [package]: Fixed dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.1] - 2024-08-20

### Changed

- [shelly]: Refactor ShellyComponent and ShellyComponent jest tests.
- [shelly]: Refactor ShellyUpdateHandler with stronger type checking.
- [shelly]: Refactor LightCommandHandler with stronger type checking.
- [shelly]: Refactor CoverCommandHandler with stronger type checking.
- [package]: Updated dependencies.

### Added

- [plugin]: Added exposeInputEvent option to the config.
- [package]: Updated readme.MD with guidelines to add gen. 2 and 3 wifi battery-powered devices (e.g. shellyhtg3).
- [shelly]: Added support for shelly0110dimg3.

### Fixed

- [package]: Fixed dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.9.0] - 2024-08-14

### Added

- [shelly]: Added support for BLU devices (beta).
- [shelly]: Added support for Shelly BLU Button1 - SBBT-002C.
- [shelly]: Added support for Shelly BLU DoorWindow - SBDW-002C.
- [shelly]: Added support for Shelly Shelly BLU HT - SBHT-003C.
- [shelly]: Added support for Shelly BLU Motion - SBMO-003Z.
- [shelly]: Added PowerSource.BatChargeLevel.Warning state when the battery is below 20%.
- [shelly]: Added PowerSource.BatChargeLevel.Critical state when the battery is below 10%.
- [shelly]: Added component Humidity (humidity).
- [shelly]: Added detection of sleeping devices Gen. 2 and Gen. 3 (e.g. shellyhtg3).
- [shelly]: Added WsServer to get updates and events from Gen. 2 and Gen 3. devices with sleep mode.
- [shelly]: Added support for shellyhtg3 (beta).

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.8.1] - 2024-08-12

### Changed

- [package]: Updated dependencies.
- [package]: Updated readme.MD with guidelines to add wifi battery-powered devices.
- [package]: Update readme.MD with guidelines to add BLU devices.
- [shelly]: Refactor WsClient and WsClient jest tests.
- [fetch]: Changed timeout for fetch to 10 secs.

### Added

- [plugin]: Added debugWs option to the config.
- [plugin]: Enabled enableBleDiscover option in the config.
- [shelly]: Added support for BLU devices (alpha).

### Fixed

- [shelly]: Added strict type checking to updates from devices to prevent validation errors caused by unsupported devices or firmware.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.8.0] - 2024-08-09

### Added

- [shelly]: Added support for wifi battery powered devices.
- [shelly]: Added support for wifi battery powered devices with sleep_mode.
- [shelly]: Added component Battery (level and charging).
- [shelly]: Added component Sensor (motion and contact).
- [shelly]: Added component Lux (luminance).
- [shelly]: Added component Temperature (temperature).
- [shelly]: Added component Vibration (vibration).
- [shelly]: Added component Flood (flood).
- [shelly]: Added component Rgb (rgb).
- [shelly]: Added component Rgbw (rgbw).
- [shelly]: Added support for event, event_cnt Input components (they are always momentary switch in matter).
- [shelly]: Added support for shellybutton1.
- [shelly]: Added support for shellymotionsensor.
- [shelly]: Added support for shellymotion2.
- [shelly]: Added support for shellydw1.
- [shelly]: Added support for shellydw2.
- [shelly]: Added support for shellyflood.
- [shelly]: Added support for shellyplusrgbwpm in rgb mode
- [fetch]: Added a timeout of 5 secs to fetch (for devices with sleep mode).

### Changed

- [package]: Updated dependencies.
- [package]: Updated typescript-eslint to 8.0.0.
- [shelly]: Refactor MdnsScanner and MdnsScanner jest test.
- [shelly]: Refactor CoapServer and CoapServer jest test.

### Verified

- [shelly]: Verified shellypro1pm with firmware v. 1.4.0
- [shelly]: Verified shellypro2pm profile switch with firmware v. 1.4.0
- [shelly]: Verified shellypro2pm profile cover with firmware v. 1.4.0
- [shelly]: Verified shellypro4pm with firmware v. 1.4.0
- [shelly]: Verified shellyproem50 with firmware v. 1.4.0
- [shelly]: Verified shellyplus1 with firmware v. 1.4.0
- [shelly]: Verified shellyplus1pm with firmware v. 1.4.0
- [shelly]: Verified shellyplus2pm profile switch with firmware v. 1.4.0
- [shelly]: Verified shellyplus2pm profile cover with firmware v. 1.4.0
- [shelly]: Verified shellyplusi4 with firmware v. 1.4.0
- [shelly]: Verified shellyplusrgbwpm with firmware v. 1.4.0
- [shelly]: Verified shelly1mini with firmware v. 1.4.0
- [shelly]: Verified shelly1pmmini with firmware v. 1.4.0
- [shelly]: Verified shellypmminig3 with firmware v. 1.4.0
- [shelly]: Verified shelly1minig3 with firmware v. 1.4.0
- [shelly]: Verified shelly1pmminig3 with firmware v. 1.4.0
- [shelly]: Verified shelly1 with firmware v. 1.14.0
- [shelly]: Verified shelly1l with firmware v. 1.14.0
- [shelly]: Verified shellybutton1 with firmware v. 1.14.0
- [shelly]: Verified shellymotionsensor with firmware v. 2.2.4
- [shelly]: Verified shellymotion2 with firmware v. 2.2.4
- [shelly]: Verified shellyflood with firmware v. 1.14.0
- [shelly]: Verified shellydw1 with firmware v. 1.14.0
- [shelly]: Verified shellydw2 with firmware v. 1.14.0
- [shelly]: Verified shellyplug-s with firmware v. 1.14.0
- [shelly]: Verified shellyplugsg3 with firmware v. 1.2.2
- [shelly]: Verified shellyem3 with firmware v. 1.14.0
- [shelly]: Verified shellyemg3 with firmware v. g1216eb0
- [shelly]: Verified shellyddimmerg3 with firmware v. g55db545

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.7.5] - 2024-07-28

### Changed

- [imports]: Updated matterbridge imports (the plugin needs Matterbridge >= 1.4.1).
- [package]: Updated dependencies.
- [logger]: Update node-ansi-logger to 2.0.6.
- [storage]: Update node-persist-manager to 1.0.8.
- [shelly]: Changed update available message only for stable updates (ignore beta updates).

### Fixed

- [shelly]: Fixed issue when Input.state is null.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.7.4] - 2024-07-23

### Changed

- [imports]: Updated matterbridge imports.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.7.3] - 2024-07-10

### Changed

- [imports]: Updated matterbridge imports.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.7.2] - 2024-07-09

### Changed

- [package]: Updated dependencies.
- [imports]: Updated matterbridge imports.

### Fixed

- [shelly]: Fixed issue caused by a shelly with undefined data.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.7.1] - 2024-07-05

### Changed

- [package]: Updated dependencies (ws and coap)

### Fixed

- [shelly]: Fixed issue caused by a shelly gen 1 when it sends a CoIoT message /cit/d without blk.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.7.0] - 2024-06-30

### Changed

- [Input]: The Input component is now fully supported. The Input can be set in the config like disabled, contact, momentary or latching.

### Fixed

- [PowerMeter]: Fixed voltage error message in PowerMeter.
- [shelly]: Fixed authentication.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.6.1] - 2024-06-28

### Changed

- [firmware]: The recent firmware update for Gen 2 and Gen. 3 devices changed the way data is sent. This fix the electrical readings.
- [package]: Updated eslint to 9.6.0

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.6.0] - 2024-06-26

### Added

- [configure]: Introduced `onConfigure()` for the persisted attributes of the OnOff cluster and WindowCovering cluster. The attributes are now updated from Shelly devices.
- [websocket]: Implemented an interval check for Gen 2 and Gen 3 devices to verify if the WebSocket client is still connected. The system will attempt to reconnect and log a message if it fails.

### Changed

- [package]: Updated dependencies

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.5.1] - 2024-06-25

### Added

- [color]: Added ColorControl cluster to shelly device with rgb.
- [current]: Added the current value to EveHistory electrical cluster.

### Fixed

- [cover]: Fix cover move to position for gen 2.
- [power]: Fix power value update.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.4.0] - 2024-06-23

### Added

- [update]: If the device has a firmware update available, a message is displayed.
- [update]: If the device's CoIoT is not correctly set, a message is displayed.

### Fixed

- [deviceGen2]: Fix mdnsDiscovery for gen 2 pro devices. When you upgrade select resetStorageDiscover on the first start please.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.3.3] - 2024-06-21

### Added

- [deviceGen2]: Fix power meter update from gen. 2/3 devices.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.3.2] - 2024-06-21

### Added

- [Gen. 1]: PowerMeter and fix update from gen. 1 devices.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [0.3.1] - 2024-06-19

First published release.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

<!-- Commented out section
## [1.1.2] - 2024-03-08

### Added

- [Feature 1]: Description of the feature.
- [Feature 2]: Description of the feature.

### Changed

- [Feature 3]: Description of the change.
- [Feature 4]: Description of the change.

### Deprecated

- [Feature 5]: Description of the deprecation.

### Removed

- [Feature 6]: Description of the removal.

### Fixed

- [Bug 1]: Description of the bug fix.
- [Bug 2]: Description of the bug fix.

### Security

- [Security 1]: Description of the security improvement.
-->
