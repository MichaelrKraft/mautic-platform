# Mautic Platform (GHL Clone) - Action Plan to Production

## Executive Summary

Your GHL CRM clone using Mautic as the core engine is **60% complete**. It has solid architecture with multi-tenant provisioning scripts, a polished Next.js dashboard matching your Coder1 design system, and OAuth integration with Mautic. However, it needs critical fixes, authentication, and deployment infrastructure.

**Estimated time to production-ready: 3-4 weeks of focused work**

---

## Current State Assessment

### What's Excellent

| Component | Quality | Notes |
|-----------|---------|-------|
| Multi-Tenant Architecture | A | Separate Mautic instances per client, good isolation |
| Provisioning Scripts | A | Well-written bash scripts with proper error handling |
| OAuth 2.0 Client | A | Complete Mautic API client with token refresh |
| UI/UX Design | A | Matches Coder1 aesthetic, dark theme, cyan accents |
| Dashboard Pages | B+ | Contacts, Campaigns, Emails, Forms, Segments, SMS, Reports |
| Server Scripts | A | Automated setup for Ubuntu/Apache/MySQL/PHP |

### What's Missing (Critical)

| Component | Severity | Effort |
|-----------|----------|--------|
| Build Errors | Critical | 1 day |
| User Authentication | High | 3-4 days |
| Database Setup | High | 1-2 days |
| Token Persistence | High | 1 day |
| Multi-Tenant Routing | High | 2-3 days |
| Settings/Billing Pages | Medium | 2-3 days |
| Deployment Pipeline | Medium | 2 days |

---

## Phase 1: Fix Build Errors (Day 1)

### Priority 1.1: Fix Route Export Error

**Current**: Build fails due to invalid route export

**File**: `src/app/api/mautic/auth/route.ts`

**Fix**: Remove the exported functions that shouldn't be exported from a route:

```typescript
// REMOVE these lines from the route file:
// export function getStoredTokens() { ... }
// export function setStoredTokens(tokens: typeof storedTokens) { ... }

// Instead, move to a separate file: src/lib/auth-store.ts
```

### Priority 1.2: Fix ESLint Errors

**Issue**: Unused variables in catch blocks

**Fix**: Use underscore prefix for unused error variables:

```typescript
// Change this:
} catch (err) {
  setError('Failed to initiate OAuth flow');
}

// To this:
} catch (_err) {
  setError('Failed to initiate OAuth flow');
}
```

**Files to fix**:
- `src/app/page.tsx`
- `src/app/contacts/page.tsx`
- `src/app/campaigns/page.tsx`
- `src/app/emails/page.tsx`
- `src/app/forms/page.tsx`
- `src/app/segments/page.tsx`
- `src/app/reports/page.tsx`
- `src/app/sms/page.tsx`

### Priority 1.3: Fix SMS Page Entity Escape

**File**: `src/app/sms/page.tsx`

**Fix**: Change `'` to `&apos;` or use template literals

---

## Phase 2: Add User Authentication (Week 1)

### Priority 2.1: Install Auth Dependencies

```bash
npm install next-auth@beta @auth/core bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken
```

### Priority 2.2: Create Auth System

**Create `src/lib/auth.ts`**:
```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { sql } from "./db"; // Your DB connection
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const user = await sql`
          SELECT * FROM users WHERE email = ${credentials.email}
        `;
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          tenantId: user.tenant_id,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      session.user.tenantId = token.tenantId;
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.tenantId = user.tenantId;
      return token;
    },
  },
});
```

### Priority 2.3: Create Login/Signup Pages

**Create `src/app/login/page.tsx`** with form for email/password login.

**Create `src/app/signup/page.tsx`** with registration flow.

### Priority 2.4: Protect Dashboard Routes

Create middleware at `src/middleware.ts`:
```typescript
import { auth } from "@/lib/auth";

export default auth((req) => {
  if (!req.auth && !req.nextUrl.pathname.startsWith('/login')) {
    const newUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Phase 3: Database & Multi-Tenancy (Week 2)

### Priority 3.1: Set Up PostgreSQL for Dashboard

**Create `src/lib/db.ts`**:
```typescript
import { neon } from '@neondatabase/serverless';
// Or use pg for local PostgreSQL

export const sql = neon(process.env.DATABASE_URL!);
```

### Priority 3.2: Create Database Schema

```sql
-- Users and Tenants (as designed in CLAUDE.md)
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    mautic_url VARCHAR(255) NOT NULL,
    mautic_client_id VARCHAR(255),
    mautic_client_secret VARCHAR(255),
    mautic_access_token TEXT,
    mautic_refresh_token TEXT,
    mautic_token_expires_at TIMESTAMP,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tenant_id INTEGER REFERENCES tenants(id),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Priority 3.3: Dynamic Mautic Client per Tenant

**Update `src/lib/mautic-server.ts`**:
```typescript
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { MauticClient } from "./mautic-client";

export async function getTenantMauticClient() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error("Not authenticated");
  }

  const tenant = await sql`
    SELECT * FROM tenants WHERE id = ${session.user.tenantId}
  `;

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const client = new MauticClient({
    baseUrl: tenant.mautic_url,
    clientId: tenant.mautic_client_id,
    clientSecret: tenant.mautic_client_secret,
  });

  // Restore tokens if available
  if (tenant.mautic_access_token) {
    client.setTokens({
      accessToken: tenant.mautic_access_token,
      refreshToken: tenant.mautic_refresh_token,
      expiresAt: new Date(tenant.mautic_token_expires_at),
    });
  }

  return { client, tenant };
}
```

### Priority 3.4: Token Persistence to Database

**Update OAuth callback to save tokens**:
```typescript
// After exchangeCodeForTokens succeeds:
await sql`
  UPDATE tenants SET
    mautic_access_token = ${tokens.accessToken},
    mautic_refresh_token = ${tokens.refreshToken},
    mautic_token_expires_at = ${tokens.expiresAt}
  WHERE id = ${session.user.tenantId}
`;
```

---

## Phase 4: Polish & Deploy (Week 3-4)

### Priority 4.1: Create Admin Dashboard

Build tenant management UI for you (super admin):
- View all tenants
- Provision new tenants (runs create-tenant.sh remotely or via API)
- Monitor usage

### Priority 4.2: Settings Page

**Create `src/app/settings/page.tsx`**:
- Profile editing
- Mautic reconnection
- API credentials display
- Usage statistics

### Priority 4.3: Billing Integration (Optional for MVP)

If monetizing:
- Stripe integration for subscription tiers
- Usage metering (contacts, emails sent)
- Upgrade/downgrade flows

### Priority 4.4: Deploy to VPS

**Deploy Dashboard**:
```bash
# On VPS
cd /var/www/dashboard
git pull
npm install --production
npm run build
pm2 restart dashboard
```

**Create nginx reverse proxy**:
```nginx
server {
    listen 80;
    server_name app.yourplatform.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Quick Wins (Can Do Today)

1. **Fix all build errors** - Run `npm run build` successfully
2. **Add missing `.env.local` template** - Document required env vars
3. **Add loading states** - Already implemented, verify they work
4. **Test OAuth flow end-to-end** - Connect to your ploink.site Mautic instance

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Marketing Platform                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────────┐     ┌──────────────────────────────┐  │
│   │   Next.js       │     │   VPS (Linode/DigitalOcean)  │  │
│   │   Dashboard     │────▶│                              │  │
│   │   (Vercel)      │     │   ┌────────────────────────┐ │  │
│   └─────────────────┘     │   │ Mautic Instance 1      │ │  │
│          │                │   │ (client1.yoursite.com) │ │  │
│          │                │   └────────────────────────┘ │  │
│          │                │                              │  │
│          ▼                │   ┌────────────────────────┐ │  │
│   ┌─────────────────┐     │   │ Mautic Instance 2      │ │  │
│   │   PostgreSQL    │     │   │ (client2.yoursite.com) │ │  │
│   │   (Neon/Supabase)│    │   └────────────────────────┘ │  │
│   │                 │     │                              │  │
│   │ - Users         │     │   ┌────────────────────────┐ │  │
│   │ - Tenants       │     │   │ Mautic Instance N      │ │  │
│   │ - OAuth Tokens  │     │   │ (clientN.yoursite.com) │ │  │
│   └─────────────────┘     │   └────────────────────────┘ │  │
│                           │                              │  │
│                           │   MySQL (per-tenant DBs)     │  │
│                           │   Apache + PHP 8.1           │  │
│                           │   Let's Encrypt SSL          │  │
│                           └──────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Comparison: GHL vs Your Platform

| Feature | GoHighLevel | Your Platform (Current) | Your Platform (After Plan) |
|---------|-------------|------------------------|---------------------------|
| CRM/Contacts | ✅ | ✅ | ✅ |
| Email Marketing | ✅ | ✅ (via Mautic) | ✅ |
| SMS Marketing | ✅ | ⚠️ Shared number | ⚠️ (Upgrade later) |
| Marketing Automation | ✅ | ✅ | ✅ |
| Funnels/Landing Pages | ✅ | ❌ | 🚧 (WordPress phase) |
| Calendar/Booking | ✅ | ❌ | 🚧 (Cal.com webhooks) |
| Membership Sites | ✅ | ❌ | ❌ |
| White Label | ✅ | ✅ | ✅ |
| Pricing | $97-497/mo | Self-hosted cost | Self-hosted cost |

---

## Technical Debt to Address

1. **Hardcoded Mautic URL**: Dashboard has `ploink.site` hardcoded in several places
   - Should come from tenant configuration dynamically

2. **File-based Token Storage**: Current `token-store.ts` uses filesystem
   - Must migrate to database for multi-instance deployment

3. **Missing Error Boundaries**: Add React error boundaries around pages

4. **No Tests**: Add basic integration tests for API routes

5. **No Rate Limiting**: Add rate limiting to prevent API abuse

---

## Environment Variables Needed

```bash
# Dashboard (.env.local)
DATABASE_URL=postgresql://user:pass@host:5432/mautic_dashboard
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=https://app.yourplatform.com

# Per-tenant (stored in DB, not env vars)
# - mautic_url
# - mautic_client_id
# - mautic_client_secret
```

---

## Immediate Next Steps

### Today
- [ ] Fix all build errors (Priority 1.1-1.3)
- [ ] Verify build passes with `npm run build`
- [ ] Test OAuth flow with ploink.site

### This Week
- [ ] Set up PostgreSQL database
- [ ] Implement user authentication (login/signup)
- [ ] Add route protection middleware

### Next Week
- [ ] Implement multi-tenant Mautic client
- [ ] Token persistence to database
- [ ] Create settings page

---

## Files to Modify (Priority Order)

1. `src/app/api/mautic/auth/route.ts` - Fix export error
2. `src/app/*/page.tsx` (all pages) - Fix ESLint errors
3. `src/lib/auth.ts` - Create new (authentication)
4. `src/lib/db.ts` - Create new (database connection)
5. `src/middleware.ts` - Create new (route protection)
6. `src/lib/mautic-server.ts` - Update for multi-tenancy
7. `src/app/login/page.tsx` - Create new
8. `src/app/settings/page.tsx` - Create new

---

## Summary

Your GHL clone has a solid foundation with impressive multi-tenant architecture. The main gaps are:

1. **Authentication** - Users can't log in yet
2. **Database** - PostgreSQL not set up for dashboard
3. **Build errors** - Simple fixes needed
4. **Multi-tenancy** - Dashboard needs to route to correct Mautic instance per user

The provisioning scripts are production-ready. Once the dashboard has auth and database support, you'll have a functional GHL alternative.

**Recommended approach**: Fix build errors first, then add authentication, then database. The Mautic instances (backend) already work - the dashboard just needs to connect properly.

---

*Generated: December 2024*
