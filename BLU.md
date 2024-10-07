# Shelly BLU devices

## How to add the BLU devices:

- BLU devices are supported through a local Shelly device acting as a ble gateway.

- To enable this feature, choose one or more devices that have the ble component and support the ble gateway (e.g. PRO and gen. 3 devices). To choose the ble gateway, consider the distance between the ble gataeway and your BLU device and choose the ble gateway with the better signal. It is also important to consider the signal between the gatway and you network: when possible choose a ble gateway that has an ethernet connection.

- In the gateway device web page, enable both "Enable Bluetooth" and "Enable Bluetooth gateway".

![image](https://github.com/user-attachments/assets/fa2b1712-a957-496b-8f98-8a6827bb5dbd)

- Then, go to the "Components" section and add your BLU devices in "Bluetooth (BTHome) devices".

![image](https://github.com/user-attachments/assets/d18ac23f-5f30-4ab0-b8c6-3c3dec11f931)
![image](https://github.com/user-attachments/assets/1286b23a-6a16-4016-a0ef-cc4abc221118)

- Give a meaningful name to your device if desired (it will be used by your controller).
- Check if the ble gateway is correctly receiving the updates from the BLU devices.

![image](https://github.com/user-attachments/assets/27998b62-00bc-4e61-ac7f-493e4e419faf)
![image](https://github.com/user-attachments/assets/458df93b-5a22-4b61-b312-38f6da6ff6e8)

- In the plugin config enable bleDiscover.

![image](https://github.com/user-attachments/assets/aa004f25-2ae8-4656-b0c1-a0b5155c6902)

- Restart Matterbridge.
- In the Devices section of the frontend you will see:

![image](https://github.com/user-attachments/assets/581c8e45-b126-4db2-a043-b5bdb47214aa)

## How to debug the BLU devices:

- In the Setting section of the frontend enable debug and log on file:

![image](https://github.com/user-attachments/assets/56906ad0-af6c-47cf-9d2b-c8451b2875ff)

- In the plugin config enable debug:

![image](https://github.com/user-attachments/assets/93336af3-d948-4af8-96ff-1c6e69750a33)

- Restart Matterbridge.
- In the log file, when the shellies are loaded, you should see something like this for your ble gatways:

![image](https://github.com/user-attachments/assets/0e8861db-56df-4c8d-bc22-2145cfac6a7e)

![image](https://github.com/user-attachments/assets/18a22455-241d-4cc6-bedd-3b2a220aaf56)

this means that the plugin has found the connected ble device.

- In the log file you will see then something like this when the BLU devices sends updates to the ble gateway:

![image](https://github.com/user-attachments/assets/b7439fa0-f36c-4f8d-9b23-c29ef9620d4f)

![image](https://github.com/user-attachments/assets/20576002-ff21-4297-b042-b636af115d2f)

![image](https://github.com/user-attachments/assets/3aece089-6550-4bb7-93f4-a1bd7c85ec23)

![image](https://github.com/user-attachments/assets/a01a04f0-2508-41ba-b3b4-46217efca922)

If you don't receive updates, try to pair the BLU devices to another Gen3 or Pro device. Then restart again MatterBridge.
