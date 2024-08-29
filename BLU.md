How to add the BLU devices:
- BLU devices are supported through a local Shelly device acting as a ble gateway.
- To enable this feature, choose one or more devices that have the ble component and support the ble gateway (e.g. PRO and gen. 3 devices).
- In the gateway device web page, enable both "Enable Bluetooth" and "Enable Bluetooth gateway".

![image](https://github.com/user-attachments/assets/fa2b1712-a957-496b-8f98-8a6827bb5dbd)

- Then, go to the "Components" section and add your BLU devices in "Bluetooth (BTHome) devices".

![image](https://github.com/user-attachments/assets/d18ac23f-5f30-4ab0-b8c6-3c3dec11f931)

- Give a meaningful name to your device if desired (it will be used by your controller).
- In the plugin config enable bleDiscover.

![image](https://github.com/user-attachments/assets/aa004f25-2ae8-4656-b0c1-a0b5155c6902)

- Restart Matterbridge.
- In the Devices section of the frontend you will see:
  
![image](https://github.com/user-attachments/assets/581c8e45-b126-4db2-a043-b5bdb47214aa)

