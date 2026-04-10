# Deployment Guide

## Current Production

**URL:** https://your-domain.com/dashboard

**Hosting:** Vercel (static files)

**Source:** `~/c/mine/website/` repo

---

## Legacy Dashboard Deployment

The current static dashboard deploys via Vercel:

```bash
# From legacy dashboard directory
cd ~/c/Sales/dashboard

# 1. Export fresh data from ActiveCampaign
./export.sh 7       # Last 7 days
# or
./export.sh 30      # Last 30 days

# 2. Copy files to website repo
cp data/journey-data.json ~/c/mine/website/public/sales/data/
cp dashboard/index.html ~/c/mine/website/public/sales/

# 3. Deploy to Vercel
cd ~/c/mine/website && vercel --prod --yes
```

---

## New Supabase Dashboard Deployment

### Prerequisites

1. **Supabase Project**
   - Create at https://supabase.com
   - Note project ref and anon key

2. **Supabase CLI**
   ```bash
   npm install -g supabase
   supabase login
   ```

3. **Environment Variables**
   ```bash
   # .env.local
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

   # For AC sync edge function
   ACTIVECAMPAIGN_URL=https://your-account.api-us1.com
   ACTIVECAMPAIGN_API_KEY=<api-key>
   ```

### Database Deployment

```bash
cd ~/c/dashboard

# Link to Supabase project
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push

# Or run specific migration
supabase migration up
```

### Edge Functions Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy ac-webhook
supabase functions deploy ac-sync
```

### Frontend Deployment

**Option A: Vercel (recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd ~/c/dashboard
vercel --prod
```

**Option B: Same site as current**
```bash
# Build frontend
npm run build

# Copy to website repo
cp -r dist/* ~/c/mine/website/public/dashboard/

# Deploy
cd ~/c/mine/website && vercel --prod --yes
```

---

## Webhook Configuration

### ActiveCampaign

1. Go to AC Settings → Developer → Webhooks
2. Add webhook URL: `https://<project-ref>.supabase.co/functions/v1/ac-webhook`
3. Select events:
   - Contact added
   - Contact updated
   - Deal added
   - Deal updated
   - Tag added
   - Tag removed

### WooCommerce

1. Go to WooCommerce → Settings → Advanced → Webhooks
2. Add webhook:
   - Delivery URL: `https://<project-ref>.supabase.co/functions/v1/woo-webhook`
   - Topic: Order created
   - Status: Active

### Typeform

1. Go to form → Connect → Webhooks
2. Add endpoint: `https://<project-ref>.supabase.co/functions/v1/typeform-webhook`

### Calendly

1. Go to Integrations → Webhooks
2. Add endpoint: `https://<project-ref>.supabase.co/functions/v1/calendly-webhook`
3. Subscribe to: invitee.created, invitee.canceled

---

## Supabase Cron (Scheduled Sync)

For incremental AC sync, set up cron job in Supabase:

```sql
-- In Supabase SQL editor
select cron.schedule(
  'ac-incremental-sync',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/ac-sync',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  );
  $$
);
```

---

## Monitoring

### Supabase Dashboard
- Edge function logs: Dashboard → Edge Functions → Logs
- Database: Dashboard → Table Editor
- Auth: Dashboard → Authentication

### Vercel
- Deployment logs: vercel.com dashboard
- Analytics: vercel.com/analytics

---

## Rollback

### Edge Functions
```bash
# List deployments
supabase functions list

# Redeploy previous version
supabase functions deploy <function-name> --version <version>
```

### Database
```bash
# List migrations
supabase migration list

# Rollback (manual SQL required)
# Create a new migration that reverses changes
```

### Frontend (Vercel)
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote <deployment-url>
```
