# Mautic Platform - Go Highlevel Replacement

Self-hosted marketing automation platform using Mautic as the core engine.

## Project Structure

```
mautic-platform/
├── dashboard/          # Next.js client-facing dashboard
├── scripts/            # Server setup and automation scripts
├── configs/            # Apache vhosts, SSL, cron templates
└── docs/               # Documentation
```

## Architecture

- **Core Engine:** Mautic 5.1.x (separate instance per tenant)
- **Client Dashboard:** Next.js 14 + React (matches Coder1 design)
- **Funnels:** WordPress Multisite + Elementor
- **Email:** Amazon SES
- **SMS:** Twilio (shared number for MVP)
- **Calendar:** Calendly/Cal.com webhooks

## Multi-Tenancy

Each client gets:
- Their own Mautic instance (`/var/www/mautic-{clientname}/`)
- Their own MySQL database (`{clientname}_db`)
- Their own subdomain (`clientname.yourplatform.com`)

## Quick Start

1. Provision Linode VPS (4GB, Ubuntu 22.04)
2. Run `scripts/server-setup.sh`
3. Run `scripts/install-mautic-template.sh`
4. For each client: `scripts/create-tenant.sh clientname`

## Plans

- Original plan: `~/.claude/plans/shiny-painting-moth.md`
- Revised plan: `~/.claude/plans/scalable-finding-starling.md`
