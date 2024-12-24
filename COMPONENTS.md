# Shelly Components Configuration

All components for all devices are exposed to Matter, but it is possible to exclude certain components globally or on a per-device basis.


## Example 1: How to Blacklist a Component on a shellyplusrgbwpm Device

Given the components of a shellyplusrgbwpm device (as shown in the logs from the console or frontend):

<img width="709" alt="image" src="https://github.com/user-attachments/assets/6602087b-cc51-43c1-a93d-98d351054cf9" />

### Blacklist Using the Component Name

To blacklist all Input components of this device, use the component name as shown below:

```
"deviceEntityBlackList": { "shellyplusrgbwpm-ECC9FF4CEAF0": ["Input"] }
```

### Blacklist Using the Component IDs

To blacklist only the third (input:2) and fourth (input:3) Input components of this device, use the component IDs as follows:

```
"deviceEntityBlackList": { "shellyplusrgbwpm-ECC9FF4CEAF0": ["input:2", "input:3"] }
```


## Example 2: How to Blacklist all secondary components on a BLU Motion Device with address 7c:c6:b6:65:2d:99

To expose only the motion component while blacklisting all secondary components, use the component names as shown below:

```
"deviceEntityBlackList": { "7c:c6:b6:65:2d:99": ["Illuminance", "Button"] }
```


## Example 3: How to Blacklist all secondary components on a BLU DoorWindow with address 0c:ef:f6:f1:d7:7b

To expose only the contact component while blacklisting all secondary components, use the component names as shown below:

```
"deviceEntityBlackList": { "0c:ef:f6:f1:d7:7b": ["Illuminance"] }
```


## Example 4: How to Blacklist all secondary components on a BLU HT 7c:c6:b6:65:2d:87 with address 7c:c6:b6:65:2d:87

To expose only the temperature and humidity components while blacklisting all secondary components, use the component names as shown below:

```
"deviceEntityBlackList": { "7c:c6:b6:65:2d:87": ["Button"] }
```
