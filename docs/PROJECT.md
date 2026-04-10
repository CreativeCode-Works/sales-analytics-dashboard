# Project: Sales Analytics Dashboard

**Emotional Sobriety Coaching**
*Planned 2026-03-28*

---

## Goal

Replace the fragmented use of AC, JustCall, Calendly, and other tools with a single dashboard where the sales team lives. Accurate, centralized, easy to read.

---

## Data Sources

| Source | Data | Status |
|--------|------|--------|
| ActiveCampaign | Contacts, deals, tags, automations, emails, call events, text notes, custom fields | Primary source |
| WooCommerce | Payment/ecommerce data (source of truth for revenue) | Active |
| Typeform | Quiz completions, masterclass signups | Active |
| Calendly | Bookings, appointments | Active |
| JustCall | Calls (events in AC) + Texts (notes in AC) — no direct integration needed | Via AC |
| WordPress | Traffic source / UTM data | Broken — Phase 4 |

---

## Key Metrics to Display

### Volume / Pipeline
- New contacts added (by day/week/month)
- New leads entering pipeline
- Quiz completions
- Masterclass attendees
- LTO purchasers
- Revenue / payments (WooCommerce as source of truth)
- Unsubscribes and falloffs

### Engagement
- Unique touch points per contact
- Emails sent / opened / clicked
- Texts sent / received (JustCall)
- Automations entered per contact
- Calendly bookings

### Journey / Timeline
- Visual timeline of a contact's lifecycle from first touch to conversion (or falloff)
- Individual contact view: full interaction history (emails, texts, automations, purchases)
- Source attribution (when WordPress data is fixed)

---

## Why Webhooks + Incremental Sync

The problem with pulling all data from AC on demand: slow + mismatched. API paginates at 100 records/call. Multiple calls at different times = data from different snapshots = mismatches.

**Solution:**
- AC webhooks push contact/deal updates in real-time
- Incremental sync (`updated_after` param) pulls only what changed
- WooCommerce webhooks for payment events
- Typeform webhooks for form submissions
- Calendly webhooks for bookings
- JustCall: all data already flows into AC (no direct integration needed)

---

## Database Schema (Draft)

### Core Tables
- `contacts` — AC contact data, synced via webhook + incremental
- `deals` — AC deals/pipeline
- `tags` — contact tag history
- `automations` — automation entries per contact
- `emails` — sent/open/click events
- `texts` — JustCall SMS log
- `calls` — JustCall call log
- `payments` — WooCommerce orders
- `form_submissions` — Typeform responses (quiz, masterclass)
- `appointments` — Calendly bookings
- `contact_timeline` — unified event log per contact (joins all above)

---

## Phased Build Plan

### Phase 1 — Foundation (Fix the Core)
- [ ] Audit current data pipeline — identify why masterclass numbers are wrong
- [ ] Set up Supabase project (DB + auth + edge functions)
- [ ] Build AC sync: contacts + custom fields + tags (incremental, not full pull)
- [ ] Wire AC webhooks → Supabase Edge Function for real-time updates
- [ ] Validate: contact counts and custom field values match AC exactly

### Phase 2 — Expand Data Sources
- [ ] WooCommerce webhook → payments table
- [ ] Typeform webhook → form_submissions table
- [ ] Calendly webhook → appointments table

### Phase 3 — Dashboard Views
- [ ] Pipeline overview (new contacts, leads, conversions, revenue)
- [ ] Funnel view (quiz → masterclass → LTO → program)
- [ ] Engagement metrics (touch points, email/text activity)
- [ ] Falloff / unsubscribe tracking
- [ ] Individual contact view + timeline

### Phase 4 — Source Attribution
- [ ] Fix WordPress → AC UTM/source data passthrough
- [ ] Add source breakdown to all pipeline metrics

---

## Decisions Made

1. **Masterclass/Quiz tracking** — AC custom fields ("Taken" value). LTO fields: Rise, SMD, Bundle ("Yes")
2. **JustCall** — all data already in AC. No direct integration needed.
3. **Database** — Supabase (Postgres + Auth + API + Edge Functions + Cron). All-in-one, no Railway needed.
4. **Sync workers** — Supabase Edge Functions (webhooks) + Supabase Cron (incremental sync)
5. **Dashboard URL** — your-domain.com/dashboard
6. **Access control** — all team members with an account see all data (no tiering for now)

---

## Open Questions

- What framework for the dashboard frontend? (React, Vue, SvelteKit, plain HTML?)

---

## Known Gaps / Roadmap Items

- WordPress source tracking (broken — Phase 4)
- Rep-level performance tracking (requires JustCall + Calendly + deal data joined)
- SMS/call recording review (if JustCall supports it)

---

*This is a living document. Update as architecture decisions are made.*
