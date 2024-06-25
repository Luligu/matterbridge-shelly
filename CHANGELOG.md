# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0] - 2024-06-26

### Added

- [configure]: Added onConfigure() for the persited attributes of OnOff cluster and WindowCovering cluster. The attributes are updated from shelly.
- [websocket]: Added interval for gen 2 and gen 3 devices to check if WebSocket is still connected. Try to reconnect and log message if fails.

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
