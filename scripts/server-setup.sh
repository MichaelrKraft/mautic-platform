#!/bin/bash
#
# Mautic Platform - Server Setup Script
# Run this on a fresh Ubuntu 22.04 VPS
#
# Usage: sudo ./server-setup.sh yourdomain.com
#

set -e  # Exit on error

DOMAIN=${1:-"ploink.site"}
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24)

echo "=========================================="
echo "Mautic Platform - Server Setup"
echo "Domain: $DOMAIN"
echo "=========================================="

# Save credentials
mkdir -p /root/.mautic-platform
echo "DOMAIN=$DOMAIN" > /root/.mautic-platform/credentials
echo "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD" >> /root/.mautic-platform/credentials
chmod 600 /root/.mautic-platform/credentials

echo "[1/7] Updating system..."
apt update && apt upgrade -y

echo "[2/7] Installing LAMP stack..."
apt install -y \
  apache2 \
  mysql-server \
  php8.1 \
  php8.1-{mysql,xml,curl,zip,intl,mbstring,imap,gd,bcmath,soap} \
  libapache2-mod-php8.1 \
  certbot \
  python3-certbot-apache \
  unzip \
  git \
  curl \
  wget

echo "[3/7] Configuring MySQL..."
mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$MYSQL_ROOT_PASSWORD';
FLUSH PRIVILEGES;
EOF

echo "[4/7] Configuring Apache..."
a2enmod rewrite ssl headers
systemctl restart apache2

echo "[5/7] Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[6/7] Creating directory structure..."
mkdir -p /var/www/{mautic-template,sites,dashboard}
mkdir -p /home/admin/scripts
chown -R www-data:www-data /var/www

echo "[7/7] Installing Node.js 20 LTS (for dashboard)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo ""
echo "=========================================="
echo "Server setup complete!"
echo "=========================================="
echo ""
echo "Credentials saved to: /root/.mautic-platform/credentials"
echo "MySQL root password: $MYSQL_ROOT_PASSWORD"
echo ""
echo "Next steps:"
echo "1. Point your domain DNS to this server's IP"
echo "2. Run: ./install-mautic-template.sh $DOMAIN"
echo ""
