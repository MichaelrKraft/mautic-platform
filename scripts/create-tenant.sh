#!/bin/bash
#
# Create New Tenant from Template
# Clones the template Mautic instance for a new client
#
# Usage: sudo ./create-tenant.sh clientname
#

set -e

TENANT_NAME=$1

if [ -z "$TENANT_NAME" ]; then
    echo "Usage: ./create-tenant.sh clientname"
    echo "Example: ./create-tenant.sh acme"
    exit 1
fi

# Sanitize tenant name (lowercase, alphanumeric only)
TENANT_NAME=$(echo "$TENANT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')

# Load credentials
source /root/.mautic-platform/credentials

TEMPLATE_DIR="/var/www/mautic-template"
TENANT_DIR="/var/www/mautic-$TENANT_NAME"
TENANT_DB="${TENANT_NAME}_db"
TENANT_USER="${TENANT_NAME}_user"
TENANT_PASS=$(openssl rand -base64 16)

echo "=========================================="
echo "Creating Tenant: $TENANT_NAME"
echo "=========================================="

# Check if tenant already exists
if [ -d "$TENANT_DIR" ]; then
    echo "ERROR: Tenant directory already exists: $TENANT_DIR"
    exit 1
fi

echo "[1/6] Creating database and user..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS $TENANT_DB;
CREATE USER IF NOT EXISTS '$TENANT_USER'@'localhost' IDENTIFIED BY '$TENANT_PASS';
GRANT ALL PRIVILEGES ON $TENANT_DB.* TO '$TENANT_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "[2/6] Cloning template database..."
mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" mautic_template > /tmp/template_dump.sql
mysql -u root -p"$MYSQL_ROOT_PASSWORD" $TENANT_DB < /tmp/template_dump.sql
rm /tmp/template_dump.sql

# Update domain references in database
mysql -u root -p"$MYSQL_ROOT_PASSWORD" $TENANT_DB <<EOF
UPDATE site_parameters SET value = REPLACE(value, 'template.$DOMAIN', '$TENANT_NAME.$DOMAIN') WHERE value LIKE '%template.$DOMAIN%';
UPDATE emails SET custom_html = REPLACE(custom_html, 'template.$DOMAIN', '$TENANT_NAME.$DOMAIN') WHERE custom_html LIKE '%template.$DOMAIN%';
UPDATE pages SET custom_html = REPLACE(custom_html, 'template.$DOMAIN', '$TENANT_NAME.$DOMAIN') WHERE custom_html LIKE '%template.$DOMAIN%';
EOF

echo "[3/6] Copying Mautic files..."
cp -r $TEMPLATE_DIR $TENANT_DIR
chown -R www-data:www-data $TENANT_DIR

echo "[4/6] Updating local.php configuration..."
cat > $TENANT_DIR/app/config/local.php <<EOF
<?php
\$parameters = array(
    'db_driver' => 'pdo_mysql',
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => '$TENANT_DB',
    'db_user' => '$TENANT_USER',
    'db_password' => '$TENANT_PASS',
    'db_table_prefix' => '',
    'db_backup_tables' => true,
    'db_backup_prefix' => 'bak_',
    'site_url' => 'https://$TENANT_NAME.$DOMAIN',
    'secret_key' => '$(openssl rand -hex 32)',
    'mailer_transport' => 'smtp',
    'mailer_host' => 'email-smtp.us-east-1.amazonaws.com',
    'mailer_port' => 587,
    'mailer_encryption' => 'tls',
    'mailer_user' => 'REPLACE_WITH_SES_USER',
    'mailer_password' => 'REPLACE_WITH_SES_PASSWORD',
    'mailer_from_name' => '$TENANT_NAME',
    'mailer_from_email' => '$TENANT_NAME@$DOMAIN',
);
EOF

echo "[5/6] Creating Apache virtual host..."
cat > /etc/apache2/sites-available/mautic-$TENANT_NAME.conf <<EOF
<VirtualHost *:80>
    ServerName $TENANT_NAME.$DOMAIN
    DocumentRoot $TENANT_DIR/docroot

    <Directory $TENANT_DIR/docroot>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/mautic-$TENANT_NAME-error.log
    CustomLog \${APACHE_LOG_DIR}/mautic-$TENANT_NAME-access.log combined
</VirtualHost>
EOF

a2ensite mautic-$TENANT_NAME
systemctl reload apache2

# SSL certificate (uses wildcard if available, otherwise individual cert)
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "[5b/6] Using wildcard SSL certificate..."
    cat > /etc/apache2/sites-available/mautic-$TENANT_NAME-ssl.conf <<EOF
<VirtualHost *:443>
    ServerName $TENANT_NAME.$DOMAIN
    DocumentRoot $TENANT_DIR/docroot

    <Directory $TENANT_DIR/docroot>
        AllowOverride All
        Require all granted
    </Directory>

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem

    ErrorLog \${APACHE_LOG_DIR}/mautic-$TENANT_NAME-error.log
    CustomLog \${APACHE_LOG_DIR}/mautic-$TENANT_NAME-access.log combined
</VirtualHost>
EOF
    a2ensite mautic-$TENANT_NAME-ssl
    systemctl reload apache2
else
    echo "[5b/6] Requesting individual SSL certificate..."
    certbot --apache -d $TENANT_NAME.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || {
        echo "WARNING: SSL setup failed. Run manually: certbot --apache -d $TENANT_NAME.$DOMAIN"
    }
fi

echo "[6/6] Setting up cron jobs..."
cat >> /etc/cron.d/mautic-tenants <<EOF

# Mautic Tenant: $TENANT_NAME
* * * * * www-data php $TENANT_DIR/bin/console mautic:segments:update --no-interaction >> /var/log/mautic/$TENANT_NAME-segments.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:campaigns:update --no-interaction >> /var/log/mautic/$TENANT_NAME-campaigns.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:campaigns:trigger --no-interaction >> /var/log/mautic/$TENANT_NAME-trigger.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:emails:send --no-interaction >> /var/log/mautic/$TENANT_NAME-emails.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:broadcasts:send --no-interaction >> /var/log/mautic/$TENANT_NAME-broadcasts.log 2>&1
*/5 * * * * www-data php $TENANT_DIR/bin/console mautic:import --no-interaction >> /var/log/mautic/$TENANT_NAME-import.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:webhooks:process --no-interaction >> /var/log/mautic/$TENANT_NAME-webhooks.log 2>&1
EOF

# Clear cache
cd $TENANT_DIR
php bin/console cache:clear --no-interaction 2>/dev/null || true

# Save tenant credentials
cat >> /root/.mautic-platform/tenants.txt <<EOF
--- Tenant: $TENANT_NAME ---
URL: https://$TENANT_NAME.$DOMAIN
Database: $TENANT_DB
DB User: $TENANT_USER
DB Password: $TENANT_PASS
Directory: $TENANT_DIR
Created: $(date)

EOF

echo ""
echo "=========================================="
echo "Tenant Created Successfully!"
echo "=========================================="
echo ""
echo "Tenant: $TENANT_NAME"
echo "URL: https://$TENANT_NAME.$DOMAIN"
echo "Database: $TENANT_DB"
echo "Directory: $TENANT_DIR"
echo ""
echo "Credentials saved to: /root/.mautic-platform/tenants.txt"
echo ""
echo "Next steps:"
echo "1. Update local.php with SES credentials"
echo "2. Create OAuth API credentials in Mautic admin"
echo "3. Add tenant to dashboard database"
echo ""
