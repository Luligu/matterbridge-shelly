#!/bin/bash
. /home/shelly/.nvm/nvm.sh

exec matterbridge -service -passcode 20242025 -discriminator 3840 -mdnsinterface end0
