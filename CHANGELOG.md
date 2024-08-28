# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge shelly plugin changelog

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-shelly and sponsoring it.

## [0.9.3] - 2024-08-29

### Added

- [shelly]: When an already discovered and stored device is discovered with a new address, the change is registered and takes effect after restarting.
- [shelly]: Added support for shellypro3em.

### Fixed

- [shelly]: Fixed WindowCovering.MovementStatus for Gen. 1 rollers

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.9.2] - 2024-08-28

### Changed

- [package]: Updated dependencies.
- [covers]: refactor Cover and Roller components for WindowCovering cluster.

### Fixed

- [package]: Fixed dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.7.4] - 2024-07-23

### Changed

- [imports]: Updated matterbridge imports.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.7.3] - 2024-07-10

### Changed

- [imports]: Updated matterbridge imports.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.7.2] - 2024-07-09

### Changed

- [package]: Updated dependencies.
- [imports]: Updated matterbridge imports.

### Fixed

- [shelly]: Fixed issue caused by a shelly with undefined data.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.7.1] - 2024-07-05

### Changed

- [package]: Updated dependencies (ws and coap)

### Fixed

- [shelly]: Fixed issue caused by a shelly gen 1 when it sends a CoIoT message /cit/d without blk.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.7.0] - 2024-06-30

### Changed

- [Input]: The Input component is now fully supported. The Input can be set in the config like disabled, contact, momentary or latching.

### Fixed

- [PowerMeter]: Fixed voltage error message in PowerMeter.
- [shelly]: Fixed authentication.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.6.1] - 2024-06-28

### Changed

- [firmware]: The recent firmware update for Gen 2 and Gen. 3 devices changed the way data is sent. This fix the electrical readings.
- [package]: Updated eslint to 9.6.0

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.6.0] - 2024-06-26

### Added

- [configure]: Introduced `onConfigure()` for the persisted attributes of the OnOff cluster and WindowCovering cluster. The attributes are now updated from Shelly devices.
- [websocket]: Implemented an interval check for Gen 2 and Gen 3 devices to verify if the WebSocket client is still connected. The system will attempt to reconnect and log a message if it fails.

### Changed

- [package]: Updated dependencies

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.5.1] - 2024-06-25

### Added

- [color]: Added ColorControl cluster to shelly device with rgb.
- [current]: Added the current value to EveHistory electrical cluster.

### Fixed

- [cover]: Fix cover move to position for gen 2.
- [power]: Fix power value update.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.4.0] - 2024-06-23

### Added

- [update]: If the device has a firmware update available, a message is displayed.
- [update]: If the device's CoIoT is not correctly set, a message is displayed.

### Fixed

- [deviceGen2]: Fix mdnsDiscovery for gen 2 pro devices. When you upgrade select resetStorageDiscover on the first start please.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.3.3] - 2024-06-21

### Added

- [deviceGen2]: Fix power meter update from gen. 2/3 devices.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.3.2] - 2024-06-21

### Added

- [Gen. 1]: PowerMeter and fix update from gen. 1 devices.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [0.3.1] - 2024-06-19

First published release.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
