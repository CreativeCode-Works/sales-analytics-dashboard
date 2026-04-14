# Dashboard UI Specification

## Layout: 3 Sections

```
┌─────────────────────────────────────────────────────────┐
│ KPI Section (3 rows: TOFU → MOFU → BOFU)               │
├─────────────────────────────────────────────────────────┤
│ Journey Timeline (stacked bar chart + filters + drill)  │
├─────────────────────────────────────────────────────────┤
│ Contact Detail (search + profile + timeline + activity) │
└─────────────────────────────────────────────────────────┘
```

---

## 1. KPI Section

All KPIs are filtered by the selected timeframe (7d / 30d / 90d / All).

### Row 1: TOFU (Top of Funnel)

| KPI | Data Source | Notes |
|-----|-----------|-------|
| **New Contacts** | `contacts.created_at` | Count by date |
| **Quiz** | Field 131 = "Taken" OR tag "takeitorleaveit-quiz" | Split: New Contacts (left) \| Existing Contacts (right). Count TOTALS not unique — new answers between pulls |
| **Masterclass** | Field 132 = "Taken" OR tag "masterclass" | Split: New \| Existing. Count increases in field 148 (MASTERCLASS_CTA) number |
| **Total Outreach** | `timeline_events` where category in (EMAIL, SMS_OUTBOUND, CALL_OUTBOUND) | Split: Total outreaches (left) \| Unique contacts reached (right) |
| **Client Responses** | `timeline_events` where category = SMS_INBOUND | Text responses from contacts |
| **Unsubscribed** | `contact_tags` where tag_name = "unsubscribed" | Contacts tagged unsubscribed |
| **Removed** | Contacts in Supabase but not in AC | Flag as `is_removed=true` during sync |

### Row 2: MOFU (Middle of Funnel)

| KPI | Data Source | Notes |
|-----|-----------|-------|
| **Completed Booking Forms** | Field 121 (WHY_NOW) recently updated | Has value = completed the booking form |
| **Calls Booked** | Calendly API | Scheduled for the timeframe |
| **Calls Scheduled (timeframe)** | Calendly API | Number of calls in the date range |
| **Reschedules + Multiple Bookings** | Calendly API | Combined count (same metric) |
| **Follow-up Calls on Books** | Calendly API | Ad-hoc events labeled "Follow Up" with host containing "discovery" |
| **Follow-up Calls (timeframe)** | Calendly API | Follow-ups scheduled in date range |
| **No-shows & Cancels** | Calendly API | Combined count |

### Row 3: BOFU (Bottom of Funnel)

| KPI | Data Source | Notes |
|-----|-----------|-------|
| **TNC Purchases** | Field 15 (amount_paid) + Field 16 (date_paid) | Total number and revenue |
| **Renewals** | Field 69 (y2_amount_paid) + Field 70 (y2_date_paid) | Y2 purchases |
| **Embodiment/Certification** | Field 98 (embodiment_amount_paid) + Field 87 (start) | Embodiment track purchases |
| **SMD** | Field 136 (contains "yes") | Date from field 139 (most_recent_purchase) |
| **RISE** | Field 137 (contains "yes") | Date from field 139 |
| **Bundle** | Field 138 (contains "yes") | Date from field 139 |

---

## 2. Journey Timeline

### Chart
- Stacked bar chart, one bar per day
- Dates below bars (not breaking them up)
- Time range selector: 7d / 14d / 30d / 90d

### Filters (combined in one location)
- **AND filters** (off by default): Has Deal, Quiz Done, Masterclass, Has Booking, Fast Lead (<24hr), Country
- **OR filters** (on by default): New Leads, Quiz Done, Masterclass, Completed Form, Booked/Upcoming, TNC, TNC Y2, LTO SMD, LTO RISE, LTO Bundle, Embodiment, Reschedules, No Show, Stop/Unsub

On page load: all OR filters ON = shows whole chart.

### Interactions
- **Hover** over day = popup with breakdown (total + count per data point)
- **Click day** = show contact cards below chart
- OR filter deselected = hide those contacts from the day view
- Can filter by different KPI categories from the top row

---

## 3. Contact Detail Section

### Global Search
- Search contacts by name or email (not just from timeline click)
- Always accessible

### Quick Filters
All | Favorites | Has Deal | Booked | No Shows | Opt-Outs | High Engage | +Lists

### Contact Cards (left sidebar)
- Name, email
- Tags as badges (e.g., "new-lead", "takeitorleaveit-quiz", "type_emotion_avoider")
- Click to view full detail

### Contact Profile (right panel)

**Header row:**
| Entry Date | Lead Time | Country | Timezone | 1st Interaction |
|-----------|-----------|---------|----------|-----------------|

**Status row:**
| Interaction Type | Next Step | Quiz | Masterclass |
|-----------------|-----------|------|-------------|

**Quiz Responses:**
- Type of Drinker, Where are you, Worries, What sounds appealing, Cut back attempts

**Lists:**
- Custom user-created lists (localStorage based, like V1)

### Stats Row
| Tags | Automations | Deals | Calls | SMS | Total |
|------|------------|-------|-------|-----|-------|

### Activity Over Time (per-contact chart)
- Stacked bar chart for individual contact
- Categories: SMS, Calls, Tags, Automations, Deals/Notes, Stop/Unsub
- Time range: 7d / 14d / 30d / All

### Tags Display
- All current tags as colored badges

### Deals Display
- Deal name, pipeline → stage, status (Open/Won/Lost), value

### Full Timeline
- Chronological list of all events from `timeline_events` table
- Filterable by category
