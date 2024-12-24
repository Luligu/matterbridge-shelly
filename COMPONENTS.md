# Shelly components configuration

All components for all device are exposed to Matter, but it is possible not to expose same components globally or on a device base.

## Example: how to black list a component on a shellyplusrgbwpm device 

Given the components of a shellyplusrgbwpm device:

<img width="709" alt="image" src="https://github.com/user-attachments/assets/6602087b-cc51-43c1-a93d-98d351054cf9" />

you can black list all Input of this device using the component name in this way:

"deviceEntityBlackList": { "shellyplusrgbwpm-ECC9FF4CEAF0": ["Input"] },

or you can black list only the third (i.e. input:2) and fourth (i.e. input:3) input of this device using the component ids in this way:

"deviceEntityBlackList": { "shellyplusrgbwpm-ECC9FF4CEAF0": ["input:2", "input:3"] },
