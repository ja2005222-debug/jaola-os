#!/bin/bash
sudo apt update && sudo apt install -y nodejs npm
sudo npm install -g pm2
git clone https://github.com/your-username/jaola-os.git /var/www/jaola-os
cd /var/www/jaola-os/backend
npm install
pm2 start ecosystem.config.cjs
