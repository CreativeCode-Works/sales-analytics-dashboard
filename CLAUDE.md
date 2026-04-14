# CLAUDE.md — V2 Sales Analytics Dashboard

## Project Overview

Sales analytics dashboard for **Emotional Sobriety Coaching**. Replaces V1's static JSON export with a Supabase/PostgreSQL backend + GitHub Actions sync pipeline. Pulls data from ActiveCampaign, with Calendly and JustCall integrations planned.

**Production URL:** Not yet deployed (V1 is at creativecode.works/sales)
**Repository:** github.com/CreativeCode-Works/sales-analytics-dashboard

## Architecture

```
ActiveCampaign API ──→ GitHub Actions (sync scripts) ──→ Supabase PostgreSQL
                                                              ↓
                                                     Dashboard (HTML/JS)
                                                     reads via Supabase JS
```

- **Sync runs on GitHub Actions** — no local credentials needed
- **Secrets stored in GitHub repo secrets** — never on disk
- **Server injects Supabase anon key** from env vars at serve time

## Current State (as of 2026-04-13)

### What's working
- Full expanded sync: contacts + notes + tags + automations + deals + email activities + contact logs
- JustCall SMS/call parsing from AC notes (server-side)
- Unified timeline_events table (built during sync)
- Incremental sync for changed contacts
- Field values explicitly fetched per contact (list endpoint doesn't include them)
- Tag-based fallback: quiz from "takeitorleaveit-quiz" tag, masterclass from "masterclass" tag
- Purchase field parsing fixed: matches any value containing "yes" (AC stores as "||Yes||")
- Dashboard connected to Supabase with real timeline data

### What's NOT working / TODO
- [ ] Full resync needed (field map corrections, new fields, purchase parsing fix)
- [ ] Removed contacts not flagged (AC has ~8,500, Supabase has ~9,537)
- [ ] Dashboard UI needs complete rebuild per spec (see DASHBOARD_SPEC.md)
- [ ] Calendly integration not built
- [ ] JustCall direct API integration not built
- [ ] Some field IDs were mapped incorrectly (see corrected map below)

## Commands

```bash
# Local development (needs SUPABASE_URL and SUPABASE_KEY env vars)
SUPABASE_URL=xxx SUPABASE_KEY=xxx node server.js    # http://localhost:3000

# GitHub Actions (all sync runs remotely via Actions tab)
# Modes: test, days, fix-fields, dump-fields, incremental, full
# Go to: GitHub → Actions → Sync AC Data → Run workflow
```

## Database Schema (Supabase)

### contacts table (33 columns → expanding to ~45)
Primary contact data + AC custom field values. See FIELD_MAP below.

### Expanded tables (created 2026-04-13)
| Table | Purpose | Rows |
|-------|---------|------|
| contact_notes | Raw AC notes (JustCall SMS/call source) | ~45 per 5 contacts |
| contact_tags | Current tags with names + dates | varies |
| contact_automations | Automation enrollments + status | ~50 per 5 contacts |
| contact_deals | Deals with pipeline/stage/value | varies |
| contact_activities | Email opens/clicks + campaign names | ~35 per 5 contacts |
| timeline_events | Unified timeline (22 event types) | ~138 per 5 contacts |
| tag_lookup | Cached tag ID → name | ~13 |
| automation_lookup | Cached automation ID → name | ~13 |
| deal_stage_lookup | Cached stage ID → title | varies |
| deal_pipeline_lookup | Cached pipeline ID → title | varies |
| sync_log | Sync run tracking | varies |

### Legacy tables (can be removed)
contact_events, contact_timeline, deals, daily_metrics, pipeline_stage_history — all empty, from earlier V2 attempts.

## AC Custom Field Map (CORRECTED)

### Currently mapped (needs correction on IDs 87-89, 149)
```js
const FIELD_MAP = {
  // Lead Magnet Progress
  131: 'quiz_taken',           // radio: "Taken" / "Not Yet Taken"
  132: 'masterclass_taken',    // radio: "Taken" / "Not Yet Taken"
  148: 'masterclass_cta',      // text: number (masterclass engagement count) — NEW

  // LTO Purchasers
  136: 'smd_purchased',        // checkbox: contains "yes" (AC stores "||Yes||")
  137: 'rise_purchased',       // checkbox: contains "yes"
  138: 'bundle_purchased',     // checkbox: contains "yes"

  // Payment & Dates
  15:  'amount_paid',          // text: "$X,XXX.00"
  16:  'date_paid',            // datetime: TNC date paid
  139: 'most_recent_purchase', // date: most recent purchase date
  145: 'date_purchased',       // date — NEW
  146: 'last_product_purchased', // text — NEW
  69:  'y2_amount_paid',       // text: Y2 amount
  70:  'y2_date_paid',         // datetime: Y2 date paid
  147: 'y2_program_end_date',  // date — NEW

  // Program Dates (CORRECTED)
  87:  'program_start',        // date: Start (was incorrectly 89)
  88:  'program_end',          // date: End (was incorrectly 149)
  89:  'iso_start_date',       // datetime: ISO start date (embodiment track)
  149: 'program_end_date',     // date: Program End Date (Date Field)

  // Embodiment Track — NEW
  98:  'embodiment_amount_paid', // text
  86:  'first_call_date',      // text

  // Attribution
  33:  'lead_source',          // text
  44:  'utm_source',           // text
  45:  'setter',               // text
  36:  'closer',               // text
  90:  'call_scheduled_by',    // text

  // Discovery Calls
  75:  'current_discovery_call',        // datetime
  32:  'most_recent_discovery_call',    // text
  35:  'confirmed_discovery_call',      // text

  // Status
  74:  'opt_in_status',        // dropdown
  95:  'podcast_only',         // text
  99:  'is_coaching_track',    // text
  106: 'independent_study',    // text
  127: 'progress',             // dropdown — NEW
  150: 'email_stage',          // text — NEW

  // Booking Form (Book A Call)
  121: 'why_now',              // textarea — NEW (MOFU: has value = completed form)
  122: 'community_preference', // dropdown
  123: 'investment_readiness', // dropdown
  124: 'decision_maker',       // dropdown
  125: 'anything_else',        // textarea

  // Quiz Responses
  126: 'type_of_drinker',      // text
  111: 'quiz_night_off',       // checkbox
  112: 'quiz_head_sounds',     // checkbox
  113: 'quiz_first_drink',     // checkbox
  114: 'quiz_conversation',    // checkbox
  115: 'quiz_cut_back',        // dropdown
  116: 'quiz_where_are_you',   // dropdown
  117: 'quiz_worries',         // dropdown
  118: 'quiz_appealing',       // checkbox

  // Location
  42:  'country',              // text — NEW
};
```

### Tag-based fallback logic
- quiz_taken: field 131 = "Taken" OR tag "takeitorleaveit-quiz"
- masterclass_taken: field 132 = "Taken" OR tag "masterclass"

### Purchase parsing
- SMD/RISE/Bundle: `val.toLowerCase().includes('yes')` (AC checkbox format: "||Yes||")

## GitHub Secrets

| Secret | Purpose |
|--------|---------|
| SUPABASE_URL | Supabase project URL |
| SUPABASE_KEY | Supabase service role key (for sync) |
| SUPABASE_MCP | Supabase MCP token (future) |
| DATABASE_URL | Supabase Postgres connection string (for migrations) |
| AC_KEY | ActiveCampaign API key |
| AC_BASE | `https://emotionalsobrietycoaching.api-us1.com/api/3` |
| AC_MCP | AC MCP token (future) |
| CALENDLY_KEY | Calendly API token (read-only, for MOFU data) |
| JUSTCALL_API_KEY | JustCall API key (for SMS/call verification) |
| JUSTCALL_API_SECRET | JustCall API secret |

## Sync Scripts

| Script | Purpose |
|--------|---------|
| sync-full.js | Full sync: all contacts + all relational data + timeline |
| sync-incremental-full.js | Only contacts updated since last sync |
| fix-field-values.js | Re-fetch field values only (fast, ~3-4 min for 500 contacts) |
| dump-fields.js | List all AC custom field definitions (IDs, names, types) |
| run-migration.js | Run SQL migrations against Supabase Postgres |

## GitHub Actions Workflow Modes

| Mode | What it does |
|------|-------------|
| test | Sync 5 oldest contacts (verification) |
| days | Sync contacts created in last N days |
| fix-fields | Re-fetch field values only for last N days |
| dump-fields | List all AC field definitions |
| incremental | Sync only contacts updated since last sync |
| full | Sync all contacts (slow, hours) |

Cron: `*/15 * * * *` runs incremental sync automatically.

## Related Files

- `DASHBOARD_SPEC.md` — Full UI specification (KPI rows, timeline, contact detail)
- `FIELD_MAP.md` — Complete AC field ID reference (all 80+ fields)
- `scripts/migrations/001_expanded_tables.sql` — Supabase table creation SQL
