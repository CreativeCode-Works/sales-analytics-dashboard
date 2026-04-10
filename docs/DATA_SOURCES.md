# Data Sources Reference

## Supabase (Live)

**Project URL:** https://your-project.supabase.co

**Current Data:**
- 9,470 contacts synced
- Custom fields mapped from AC

---

## ActiveCampaign

**API Base:** `https://your-account.api-us1.com`
**Total Contacts:** ~9,470

### Custom Field Mapping (AC → Supabase)

| AC Field ID | AC Field Tag | Supabase Column | Type |
|-------------|--------------|-----------------|------|
| 131 | DRINKING_QUIZ | quiz_taken | boolean ("Taken" = true) |
| 132 | MASTER_CLASS | masterclass_taken | boolean ("Taken" = true) |
| 136 | SMD | smd_purchased | boolean ("Yes" = true) |
| 137 | RISE | rise_purchased | boolean ("Yes/YES" = true) |
| 138 | BUNDLE | bundle_purchased | boolean ("Yes" = true) |
| 15 | AMOUNT_PAID | amount_paid | text |
| 16 | DATETIMEPAID | date_paid | text |
| 139 | MOST_RECENT_PURCHASE | most_recent_purchase | text |
| 69 | Y2_AMOUNT_PAID | y2_amount_paid | text |
| 70 | Y2_DATE_PAID_24_HR_FORMAT | y2_date_paid | text |
| 89 | ISO_START_DATE | program_start | text |
| 149 | PROGRAM_END_DATE_DATE_FIELD | program_end | text |
| 33 | LEAD_SOURCE | lead_source | text |
| 44 | UTMSOURCE | utm_source | text |
| 45 | SETTER | setter | text |
| 36 | CLOSER | closer | text |
| 90 | CALL_SCHEDULED_BY | call_scheduled_by | text |
| 75 | CURRENT_DISCOVERY_CALL | current_discovery_call | text |
| 32 | MOST_RECENT_DISCOVERY_CALL | most_recent_discovery_call | text |
| 35 | CONFIRMED_DISCOVERY_CALL | confirmed_discovery_call | text |
| 74 | OPT_IN_STATUS | opt_in_status | text |
| 95 | PODCAST_ONLY | podcast_only | text |
| 99 | IS_COACHING_TRACK | is_coaching_track | text |
| 106 | INDEPENDENT_STUDY | independent_study | text |

### Pipelines

**Pipeline 1 — Lead Nurture**
```
New (Day 1) → Day 3 → Day 5 → Day 7 → Day 14 → Quiz → Masterclass → Outreach Completed → Do Not Message
```

**Pipeline 6 — Discovery Calls**
```
New Booking → Discovery Call Ready → No Show → Canceled → Reschedule Requested → 24hr Check In
```

**Pipeline 13 — Outcomes** (booking system)
- Stage 171: On Deck
- Stage 172: In Consideration
- Stage 177: Canceled

### API Notes
- Pagination: 100 records/call
- Rate limit: 5 requests/second
- Use `updated_after` for incremental sync

---

## WooCommerce (Not Yet Integrated)

**Purpose:** Source of truth for revenue/payments

### Webhook Events (to implement)
- `order.created`
- `order.completed`

---

## Typeform (Not Yet Integrated)

**Purpose:** Quiz completions, masterclass signups

---

## Calendly (Not Yet Integrated)

**Purpose:** Discovery call bookings

---

## JustCall

**Integration:** Via AC notes (no direct integration needed)

### Note Formats in AC

**Incoming SMS:**
```
Deal Owner:
Incoming SMS
SMS ID: 515240360
Date & Time: 9th Feb 2026, 11:54am
Received from: +12048135757
Message: <content>
```

**Outgoing SMS:**
```
Outgoing SMS:
<message content>
```

### API Credentials
- API Key: Set in `.env` as `JUSTCALL_API_KEY`
- API Secret: Set in `.env` as `JUSTCALL_API_SECRET`
