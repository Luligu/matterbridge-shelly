# Flash the eMMC with the official Radxa loader and image for rock-s0:

loader: rk3308_loader_ddr589MHz_uart0_m0_v2.06.136sd.bin

image: rock-s0_debian_bookworm_cli_b6.img

```
lligu@ubuntu:~/Radxa$ rkdeveloptool ld
DevNo=1 Vid=0x2207,Pid=0x330e,LocationID=202    Maskrom
lligu@ubuntu:~/Radxa$ sudo rkdeveloptool db rk3308_loader_ddr589MHz_uart0_m0_v2.06.136sd.bin
Downloading bootloader succeeded.
lligu@ubuntu:~/Radxa$ sudo rkdeveloptool wl 0 rock-s0_debian_bookworm_cli_b6.img
Write LBA from file (100%)
lligu@ubuntu:~/Radxa$ sudo rkdeveloptool rd
Reset Device OK.
```

# Update system with rsetup

## Update and upgrade (required by Radxa docs)

```
rsetup
```

then System, System Update and confirm.

## Set locale time

```
rsetup
```

then Localization, Change Timezone.

## Set hostname (default is rock-s0)

```
rsetup
```

then User Settings, Change Hostname

then check /etc/hosts

```
sudo nano /etc/hosts
```

set the hostname of the device (change rock-s0 with the new hostname you set before)

127.0.0.1 localhost

127.0.1.1 rock-s0

# Samba without password (optional)

Copy the file smb.conf to /etc/samba/smb.conf

```
sudo curl https://raw.githubusercontent.com/Luligu/matterbridge-shelly/dev/rock-s0/samba/smb.conf -o /etc/samba/smb.conf
```

change the hostname from rock-s0 to the new hostname you set before

```
sudo nano /etc/samba/smb.conf
```

then reload the services

```
sudo systemctl restart smbd nmbd
```

if desired make them start at boot

```
sudo systemctl enable smbd nmbd
```

# Sudo without password (matterbridge will not update without this!)

Copy the file matterbridge to /etc/sudoers.d/matterbridge

```
sudo curl https://raw.githubusercontent.com/Luligu/matterbridge-shelly/dev/rock-s0/sudoers/matterbridge -o /etc/sudoers.d/matterbridge
sudo chmod 0440 /etc/sudoers.d/matterbridge
```

then check and reload the settings with:

```
sudo visudo -c
```

# Install node 22.x

```
sudo curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install -y nodejs
node -v
npm -v
```

# Install cockpit and btop and upgrade

```
sudo apt update
sudo apt install cockpit btop -y
sudo apt upgrade
```

# Install matterbridge cockpit plugin

Create the directory "\usr\share\cockpit\matterbridge"

copy all the files from cockpit directory to "\usr\share\cockpit\matterbridge"

# Prevent the journal logs to grow

```
sudo nano /etc/systemd/journald.conf
```

add

```
Compress=yes            # Compress logs
MaxRetentionSec=3days   # Keep logs for a maximum of 3 days.
MaxFileSec=1day         # Rotate logs daily within the 3-day retention period.
ForwardToSyslog=no      # Disable forwarding to syslog to prevent duplicate logging.
SystemMaxUse=100M       # Limit persistent logs in /var/log/journal to 100 MB.
RuntimeMaxUse=100M      # Limit runtime logs in /run/log/journal to 100 MB.
```

save it and run

```
sudo systemctl restart systemd-journald
```

# Install Matterbridge like a service

## First create the Matterbridge directories

```
cd ~
mkdir -p ./Matterbridge
mkdir -p ./.matterbridge
sudo chown -R $USER:$USER ./Matterbridge ./.matterbridge
```

## Install matterbridge and directly add the shelly plugin

```
sudo npm install -g matterbridge --omit=dev
sudo npm install -g matterbridge-shelly --omit=dev
matterbridge -add matterbridge-shelly
```

## Create a systemctl configuration file for Matterbridge

Copy the systemctl configuration file for Matterbridge

```
sudo curl https://raw.githubusercontent.com/Luligu/matterbridge-shelly/dev/rock-s0/systemd/matterbridge.service -o /etc/systemd/system/matterbridge.service
```

change twice the hostname with the new hostname you set before

```
sudo nano /etc/systemd/system/matterbridge.service
```

then reload the settings with:

```
sudo systemctl daemon-reload
```

## QR and manual pairing codes (they are fixed)

qrPairingCode: MT:Y.K90AFN004-JZ59G00

Manual pairing code: 3569-371-2356

## Enable and start Matterbridge service

```
sudo systemctl enable matterbridge
sudo systemctl start matterbridge
```

## View the log of Matterbridge in real time (this will show the log correctly formatted with colors)

```
sudo journalctl -u matterbridge.service -n 100 -f --output cat
```
