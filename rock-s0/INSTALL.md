Start from the official Radxa image for rock-s0: rock-s0_debian_bookworm_cli_b6.img.xz

# Update system
```
sudo apt update
sudo apt install cockpit btop -y
sudo apt upgrade
```

then set the locale time in the radxa setup
```
rsetup 
```


# Samba without password

Copy the file smb.conf to /etc/samba/smb.conf

```
curl https://raw.githubusercontent.com/Luligu/matterbridge-shelly/dev/rock-s0/samba/smb.conf -o /etc/samba/smb.conf 
```

then reload the services
```
sudo systemctl restart smbd nmbd
```


# Sudo without password

Copy the file matterbridge.conf to /etc/sudoers.d/matterbridge.conf
```
curl https://raw.githubusercontent.com/Luligu/matterbridge-shelly/dev/rock-s0/sudoers/matterbridge.conf -o /etc/sudoers.d/matterbridge.conf
```

then check and reload the settings with:

```
sudo visudo -c
```


# Install node 22.x

```
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install -y nodejs
node -v
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
curl https://raw.githubusercontent.com/Luligu/matterbridge-shelly/dev/rock-s0/systemd/matterbridge.service -o /etc/systemd/system/matterbridge.service
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