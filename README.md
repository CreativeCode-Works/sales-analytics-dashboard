# Sales Analytics Dashboard

**Emotional Sobriety Coaching**

Centralized sales dashboard replacing fragmented AC, JustCall, Calendly tools.

## Current State

| Component | Status |
|-----------|--------|
| Supabase project | Active |
| Contacts synced | 9,470 |
| Custom fields | Mapped |
| Dashboard UI | Not started |
| Real-time webhooks | Not started |

**Supabase:** https://your-project.supabase.co

## Project Structure

```
dashboard/
├── CLAUDE.md              # Context for Claude Code
├── README.md              # This file
├── docs/
│   ├── PROJECT.md        # Full project plan & phases
│   ├── DATA_SOURCES.md   # AC fields, APIs, credentials
│   └── DEPLOYMENT.md     # Production deployment
├── scripts/
│   ├── sync.js           # Full AC → Supabase sync
│   ├── sync-resume.js    # Resume sync from offset
│   └── package.json      # Script dependencies
└── src/                  # Dashboard frontend (TBD)
```

## Quick Start

```bash
# Check current DB state
cd ~/c/dashboard/scripts
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://your-project.supabase.co',
  'YOUR_SERVICE_KEY'
);
(async () => {
  const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
  console.log('Contacts:', count);
})();
"

# Run full sync
node sync.js
```

## Database Tables

### contacts
All ActiveCampaign contacts with custom fields:
- Lead magnets: `quiz_taken`, `masterclass_taken`
- Purchases: `smd_purchased`, `rise_purchased`, `bundle_purchased`
- Attribution: `lead_source`, `utm_source`, `setter`, `closer`
- Dates: `program_start`, `program_end`, `current_discovery_call`

### sync_log
Tracks sync runs, errors, and AC↔DB drift.

## Next Steps

1. Build dashboard frontend (React, SvelteKit, or plain HTML)
2. Add real-time AC webhooks
3. Integrate WooCommerce payments
4. Add Typeform/Calendly webhooks

## Related

- Legacy dashboard: https://your-domain.com/dashboard
- Booking system: https://app-production-e438.up.railway.app
