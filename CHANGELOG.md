# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge shelly plugin changelog

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-shelly and sponsoring it.

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
