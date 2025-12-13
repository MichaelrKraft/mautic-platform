# CLAUDE.md - Mautic Platform

This file provides guidance to Claude Code agents working on this repository.

## Project Overview

**Purpose**: Go Highlevel replacement using open-source Mautic as the core marketing automation engine.

**Architecture**: Multi-tenant platform where each client gets:
- Their own Mautic instance (`/var/www/mautic-{clientname}/`)
- Their own MySQL database (`{clientname}_db`)
- Their own subdomain (`clientname.yourplatform.com`)

## Project Structure

```
mautic-platform/
├── dashboard/          # Next.js 14 client-facing dashboard
│   ├── app/           # App router pages
│   ├── components/    # React components (match Coder1 design)
│   └── lib/           # Utilities, API clients, Mautic OAuth
├── scripts/           # Server setup and automation
│   ├── server-setup.sh           # Initial VPS provisioning
│   ├── install-mautic-template.sh # Golden template creation
│   └── create-tenant.sh          # New client provisioning
├── configs/           # Apache vhosts, SSL, cron templates
└── docs/              # Documentation
```

## Technology Stack

### Server Infrastructure
- **OS**: Ubuntu 22.04 LTS
- **Web Server**: Apache 2.4 with mod_rewrite, mod_ssl
- **Database**: MySQL 8.0
- **PHP**: 8.1 with required extensions
- **Hosting**: Linode VPS (4GB recommended)

### Core Applications
- **Marketing Automation**: Mautic 5.1.x (separate instance per tenant)
- **Email Delivery**: Amazon SES with SPF/DKIM/DMARC
- **SMS**: Twilio (shared number for MVP)
- **Funnels**: WordPress Multisite + Elementor (future phase)
- **Calendar**: Calendly/Cal.com webhooks (future phase)

### Client Dashboard
- **Framework**: Next.js 14 with App Router
- **UI**: React 18, Tailwind CSS, shadcn/ui
- **Design**: Matches Coder1 IDE aesthetic (dark theme, cyan accents)
- **Auth**: JWT with PostgreSQL user store

## Development Commands

```bash
# Dashboard development
cd dashboard
npm install
npm run dev          # Starts on port 3000

# Production build
npm run build
npm start
```

## Server Scripts Usage

**All scripts require root/sudo access on the VPS:**

```bash
# 1. Initial server setup (run once on fresh VPS)
sudo ./scripts/server-setup.sh yourdomain.com

# 2. Install Mautic template (run once after server setup)
sudo ./scripts/install-mautic-template.sh yourdomain.com

# 3. Create new tenant (run for each client)
sudo ./scripts/create-tenant.sh clientname
```

## Multi-Tenancy Architecture

### Why Separate Instances (Not Shared Database)
Mautic doesn't natively support database switching via environment variables. The `local.php` config file is the source of truth. Options considered:
1. ~~Environment variable switching~~ - Doesn't work with Mautic
2. ~~Custom Symfony middleware~~ - Too complex, upgrade risk
3. **Separate instances** - Chosen approach: reliable, isolated, easy backup/restore

### Tenant Provisioning Flow
1. Admin runs `create-tenant.sh clientname`
2. Script creates MySQL database and user
3. Script clones template Mautic folder
4. Script updates `local.php` with new DB credentials
5. Script creates Apache vhost and SSL cert
6. Script appends cron jobs for automation
7. Credentials saved to `/root/.mautic-platform/tenants.txt`

### Dashboard Tenant Routing
Central PostgreSQL database maps users to their Mautic instance:
```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    mautic_url VARCHAR(255) NOT NULL,
    mautic_client_id VARCHAR(255),
    mautic_client_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tenant_id INTEGER REFERENCES tenants(id),
    role VARCHAR(20) DEFAULT 'user'
);
```

## Mautic OAuth 2.0 Integration

**Important**: Mautic uses proper OAuth 2.0, not simple Bearer tokens.

### OAuth Flow
1. Create API credentials in Mautic admin (Settings > API Credentials)
2. Use Authorization Code flow for user authentication
3. Store access_token and refresh_token
4. Refresh tokens before expiry (typically 1 hour)

### API Client Pattern
```typescript
// lib/mautic-client.ts
class MauticClient {
  private accessToken: string;
  private refreshToken: string;
  private tokenExpiry: Date;

  async refreshIfNeeded(): Promise<void> {
    if (this.tokenExpiry < new Date()) {
      // POST to /oauth/v2/token with refresh_token
    }
  }

  async getContacts(): Promise<Contact[]> {
    await this.refreshIfNeeded();
    // GET /api/contacts with Authorization header
  }
}
```

## Design System (Match Coder1)

### Colors
```css
--bg-primary: #0a0a0a;
--bg-secondary: #141414;
--bg-tertiary: #1a1a1a;
--border: #2a2a2a;
--text-primary: #ffffff;
--text-secondary: #a0a0a0;
--accent-cyan: #00D9FF;
--accent-purple: #a855f7;
```

### Typography
- **Font**: Inter (Google Fonts)
- **Headings**: font-semibold
- **Body**: font-normal

### Component Patterns
- Rounded corners: `rounded-lg` or `rounded-xl`
- Subtle borders: `border border-[#2a2a2a]`
- Hover states: `hover:border-[#00D9FF]` with transition
- Cards: Dark background with subtle border glow on hover

## Critical Cron Jobs

Each Mautic instance requires these cron jobs (added by `create-tenant.sh`):

```cron
# Run every minute for real-time automation
* * * * * www-data php /path/bin/console mautic:segments:update
* * * * * www-data php /path/bin/console mautic:campaigns:update
* * * * * www-data php /path/bin/console mautic:campaigns:trigger
* * * * * www-data php /path/bin/console mautic:emails:send
* * * * * www-data php /path/bin/console mautic:broadcasts:send
*/5 * * * * www-data php /path/bin/console mautic:import
* * * * * www-data php /path/bin/console mautic:webhooks:process
```

## Environment Variables

### Dashboard (.env.local)
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mautic_dashboard

# Auth
JWT_SECRET=your-jwt-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# External Services (optional)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
```

### Server Credentials
Stored at `/root/.mautic-platform/credentials`:
```bash
DOMAIN=yourplatform.com
MYSQL_ROOT_PASSWORD=generated-password
```

## Plans and Documentation

- **Original Plan**: `~/.claude/plans/shiny-painting-moth.md`
- **Revised Plan**: `~/.claude/plans/scalable-finding-starling.md`
- **Project README**: `./README.md`

## Common Tasks

### Add New Client
```bash
ssh root@your-server
cd /home/admin/scripts
sudo ./create-tenant.sh newclientname
# Note: Update SES credentials in local.php after creation
```

### Backup Tenant
```bash
# Database
mysqldump -u root -p clientname_db > backup.sql

# Files
tar -czf mautic-clientname.tar.gz /var/www/mautic-clientname/
```

### Restore Tenant
```bash
mysql -u root -p clientname_db < backup.sql
tar -xzf mautic-clientname.tar.gz -C /
```

## Security Notes

- All tenant credentials stored in `/root/.mautic-platform/tenants.txt` (root only)
- MySQL users have database-specific permissions only
- Apache vhosts isolate tenant document roots
- SSL certificates via Let's Encrypt (auto-renewal via certbot)
- Dashboard uses bcrypt for password hashing

## Known Limitations (MVP)

1. **Shared Twilio Number**: All tenants share one SMS number
2. **No WordPress Yet**: Funnels/landing pages are Phase 2
3. **Manual SES Setup**: Each tenant needs SES credentials manually configured
4. **No Usage Metering**: Billing integration is future phase
