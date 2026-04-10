# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Sales analytics dashboard for **Emotional Sobriety Coaching**. Replaces fragmented tools (ActiveCampaign, JustCall, Calendly, WooCommerce) with a single, centralized dashboard.

## Current State

**Supabase Project:** `https://your-project.supabase.co`

**Database:**
- `contacts` table: 9,470 contacts synced from ActiveCampaign
- `sync_log` table: Tracks sync runs and drift

**Sync Scripts:** `scripts/sync.js`, `scripts/sync-resume.js`

## Project Status

- [x] Supabase project created
- [x] Contacts table schema designed
- [x] Full AC contact sync completed (~9,470 contacts)
- [x] Custom fields mapped (quiz, masterclass, purchases, attribution)
- [ ] Dashboard frontend
- [ ] Webhook handlers for real-time updates
- [ ] WooCommerce/Typeform/Calendly integration

## Credentials

**Supabase:**
- URL: `https://your-project.supabase.co`
- Service Role Key: In `scripts/sync.js`

**ActiveCampaign:**
- URL: `https://your-account.api-us1.com`
- API Key: In `scripts/sync.js`

## Database Schema

### contacts table
| Column | Type | Description |
|--------|------|-------------|
| id | text (PK) | AC contact ID |
| email | text | |
| first_name | text | |
| last_name | text | |
| phone | text | |
| created_at | timestamp | AC cdate |
| updated_at | timestamp | AC udate |
| quiz_taken | boolean | DRINKING_QUIZ field = "Taken" |
| masterclass_taken | boolean | MASTER_CLASS field = "Taken" |
| smd_purchased | boolean | SMD field = "Yes" |
| rise_purchased | boolean | RISE field = "Yes" |
| bundle_purchased | boolean | BUNDLE field = "Yes" |
| amount_paid | text | Field 15 |
| date_paid | text | Field 16 |
| most_recent_purchase | text | Field 139 |
| y2_amount_paid | text | Field 69 |
| y2_date_paid | text | Field 70 |
| program_start | text | Field 89 |
| program_end | text | Field 149 |
| lead_source | text | Field 33 |
| utm_source | text | Field 44 |
| setter | text | Field 45 |
| closer | text | Field 36 |
| call_scheduled_by | text | Field 90 |
| current_discovery_call | text | Field 75 |
| most_recent_discovery_call | text | Field 32 |
| confirmed_discovery_call | text | Field 35 |
| opt_in_status | text | Field 74 |
| podcast_only | text | Field 95 |
| is_coaching_track | text | Field 99 |
| independent_study | text | Field 106 |
| synced_at | timestamp | Last sync time |

### sync_log table
Tracks sync runs with AC total, DB total, delta, and error status.

## Commands

```bash
# Run local dashboard
cd ~/c/dashboard && npm run dev
# Opens at http://localhost:3000

# Run full AC sync (all contacts)
cd ~/c/dashboard && npm run sync

# Run incremental sync (only updated contacts)
cd ~/c/dashboard && npm run sync:incremental

# Set up cron for auto-sync (every 15 min)
crontab -e
# Add: */15 * * * * cd ~/c/dashboard && node scripts/sync-incremental.js >> ~/c/dashboard/sync.log 2>&1
```

## AC Custom Field IDs

```js
{
  131: 'quiz_taken',         // radio: Taken / Not Yet Taken
  132: 'masterclass_taken',  // radio: Taken / Not Yet Taken
  136: 'smd_purchased',      // checkbox: Yes
  137: 'rise_purchased',     // checkbox: YES
  138: 'bundle_purchased',   // checkbox: YES
  15:  'amount_paid',
  16:  'date_paid',
  139: 'most_recent_purchase',
  69:  'y2_amount_paid',
  70:  'y2_date_paid',
  89:  'program_start',
  149: 'program_end',
  33:  'lead_source',
  44:  'utm_source',
  45:  'setter',
  36:  'closer',
  90:  'call_scheduled_by',
  75:  'current_discovery_call',
  32:  'most_recent_discovery_call',
  35:  'confirmed_discovery_call',
  74:  'opt_in_status',
  95:  'podcast_only',
  99:  'is_coaching_track',
  106: 'independent_study',
}
```

## Related Projects

- `~/c/Sales/dashboard/` - Legacy static dashboard (Vercel)
- `~/c/Sales/booking-system/` - Booking confirmation system (Railway)
- `~/.openclaw/workspace/` - Original sync scripts created via OpenClaw

## Production URLs

- **Current dashboard:** https://your-domain.com/dashboard
- **Target:** your-domain.com/dashboard
