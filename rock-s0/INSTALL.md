Start flashing the eMMC with the official Radxa loader and image for rock-s0:

loader: rk3308_loader_ddr589MHz_uart0_m0_v2.06.136sd.bin
image: rock-s0_debian_bookworm_cli_b6.img

# Update system with rsetup

## Update and upgrade

```
rsetup
```

then System, System Update and confirm.

## Set time

then set the locale time in the radxa setup

```
rsetup
```

then Localization, Change Timezone.

## Set hostname

```
rsetup
```

then check /etc/hosts

```
sudo nano /etc/hosts
```

set the hostname of the device (change rock-s0 with the new hostname)

127.0.0.1 localhost
127.0.1.1 rock-s0

# Samba without password

Copy the file smb.conf to /etc/samba/smb.conf

```
sudo curl https://raw.githubusercontent.com/Luligu/matterbridge-shelly/dev/rock-s0/samba/smb.conf -o /etc/samba/smb.conf
```

change the hostname from rock-s0 to the new hostname

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

# Sudo without password

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

# Install Matterbridge like a service

## First create the Matterbridge directories

```
cd ~
mkdir -p ./Matterbridge
mkdir -p ./.matterbridge
sudo chown -R $USER:$USER ./Matterbridge ./.matterbridge
```

## Install matterbridge

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

then reload the settings with:

```
sudo systemctl daemon-reload
```

## Start Matterbridge

```
sudo systemctl enable matterbridge
sudo systemctl start matterbridge
```
