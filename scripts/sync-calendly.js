#!/usr/bin/env node
/**
 * Sync Calendly events — bookings, cancellations, no-shows, reschedules.
 *
 * Usage:
 *   node scripts/sync-calendly.js                # Last 30 days
 *   node scripts/sync-calendly.js --days 7       # Last 7 days
 *   node scripts/sync-calendly.js --days 90      # Last 90 days
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CALENDLY_KEY = process.env.CALENDLY_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !CALENDLY_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_KEY, CALENDLY_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const DAYS = getArg('--days') ? parseInt(getArg('--days')) : 30;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchCalendly(path) {
  const res = await fetch(`https://api.calendly.com${path}`, {
    headers: { 'Authorization': `Bearer ${CALENDLY_KEY}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly API ${res.status}: ${path} — ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function run() {
  const startTime = Date.now();
  console.log(`=== Calendly Sync (last ${DAYS} days) ===`);

  // Get current user to find organization
  const me = await fetchCalendly('/users/me');
  const orgUri = me.resource.current_organization;
  const userUri = me.resource.uri;
  console.log(`Organization: ${orgUri}`);
  console.log(`User: ${me.resource.name}`);

  // Build phone→contact_id lookup from Supabase
  const { data: contactLookup } = await supabase
    .from('contacts')
    .select('id, email, phone');
  const emailToId = {};
  for (const c of (contactLookup || [])) {
    if (c.email) emailToId[c.email.toLowerCase()] = c.id;
  }
  console.log(`Loaded ${Object.keys(emailToId).length} email→contact mappings`);

  // Fetch scheduled events
  const minTime = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const maxTime = new Date().toISOString();

  let allEvents = [];
  let nextPage = `/scheduled_events?organization=${encodeURIComponent(orgUri)}&min_start_time=${minTime}&max_start_time=${maxTime}&count=100&sort=start_time:asc`;

  while (nextPage) {
    const data = await fetchCalendly(nextPage);
    const events = data.collection || [];
    allEvents = allEvents.concat(events);
    console.log(`  Fetched ${allEvents.length} events...`);

    nextPage = data.pagination?.next_page_token
      ? `/scheduled_events?organization=${encodeURIComponent(orgUri)}&min_start_time=${minTime}&max_start_time=${maxTime}&count=100&page_token=${data.pagination.next_page_token}`
      : null;

    await sleep(200);
  }

  console.log(`Total events: ${allEvents.length}`);

  // Process each event — fetch invitees for contact info
  const records = [];
  let processed = 0;

  for (const event of allEvents) {
    try {
      const eventUri = event.uri;
      const eventUuid = eventUri.split('/').pop();

      // Fetch invitees
      const invData = await fetchCalendly(`/scheduled_events/${eventUuid}/invitees?count=100`);
      const invitees = invData.collection || [];

      for (const inv of invitees) {
        const email = (inv.email || '').toLowerCase();
        const eventTypeName = event.event_type ? event.name : '';

        // Detect follow-up: event name contains "follow up" and is with a discovery host
        const isFollowUp = /follow.?up/i.test(eventTypeName) ||
                           /follow.?up/i.test(event.event_type || '');

        // Detect no-show from invitee
        const noShow = inv.no_show?.created_at ? true : false;

        // Detect reschedule
        const rescheduled = inv.rescheduled === true;
        const rescheduledFrom = inv.old_invitee?.uri?.split('/').pop() || null;

        // Detect cancellation
        const canceled = inv.status === 'canceled' || event.status === 'canceled';
        const canceledAt = inv.cancellation?.canceled_at || (canceled ? event.updated_at : null);
        const cancelReason = inv.cancellation?.reason || null;

        records.push({
          id: eventUuid + '-' + (inv.uri?.split('/').pop() || '0'),
          contact_email: email,
          contact_name: inv.name || null,
          event_type: eventTypeName || event.event_type || null,
          event_type_slug: event.event_type || null,
          status: canceled ? 'canceled' : 'active',
          start_time: event.start_time,
          end_time: event.end_time,
          created_at: event.created_at,
          canceled_at: canceledAt,
          cancel_reason: cancelReason,
          rescheduled,
          rescheduled_from: rescheduledFrom,
          no_show: noShow,
          location: event.location?.location || event.location?.join_url || null,
          host_name: event.event_memberships?.[0]?.user_name || null,
          host_email: event.event_memberships?.[0]?.user_email || null,
          is_follow_up: isFollowUp,
          contact_id: emailToId[email] || null,
          synced_at: new Date().toISOString(),
        });
      }

      processed++;
      if (processed % 25 === 0) {
        console.log(`  Processed ${processed}/${allEvents.length} events (${records.length} invitee records)`);
      }

      await sleep(150); // Calendly rate limit
    } catch (e) {
      console.error(`  Error on event: ${e.message}`);
    }
  }

  // Upsert to Supabase
  if (records.length > 0) {
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50);
      const { error } = await supabase.from('calendly_events').upsert(batch, { onConflict: 'id' });
      if (error) console.error('Upsert error:', error.message);
    }
  }

  // Also add Calendly events to timeline_events for contacts that have a contact_id
  const timelineRecords = records.filter(r => r.contact_id).map(r => {
    let event = 'Discovery Call Booked';
    let category = 'BOOKING';
    if (r.status === 'canceled') { event = 'Call Canceled'; category = 'BOOKING'; }
    if (r.no_show) { event = 'No-Show'; category = 'BOOKING'; }
    if (r.rescheduled) { event = 'Call Rescheduled'; category = 'BOOKING'; }
    if (r.is_follow_up) event = 'Follow-Up ' + event.replace('Discovery ', '');

    const details = [
      r.event_type,
      r.host_name ? `Host: ${r.host_name}` : null,
      r.cancel_reason ? `Reason: ${r.cancel_reason}` : null,
    ].filter(Boolean).join(' | ');

    return {
      contact_id: r.contact_id,
      timestamp: r.start_time,
      category,
      event,
      details,
      source: 'Calendly',
      source_id: `calendly-${r.id}`,
      synced_at: new Date().toISOString(),
    };
  });

  // Upsert timeline events (delete old Calendly ones first for these contacts)
  const contactIds = [...new Set(timelineRecords.map(r => r.contact_id))];
  for (const cid of contactIds) {
    await supabase.from('timeline_events').delete().eq('contact_id', cid).eq('source', 'Calendly');
  }
  if (timelineRecords.length > 0) {
    for (let i = 0; i < timelineRecords.length; i += 50) {
      await supabase.from('timeline_events').insert(timelineRecords.slice(i, i + 50));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Calendly Sync Complete ===`);
  console.log(`Duration: ${elapsed}s`);
  console.log(`Events: ${allEvents.length}`);
  console.log(`Records: ${records.length}`);
  console.log(`Timeline entries: ${timelineRecords.length}`);
  console.log(`Active: ${records.filter(r => r.status === 'active' && !r.no_show).length}`);
  console.log(`Canceled: ${records.filter(r => r.status === 'canceled').length}`);
  console.log(`No-shows: ${records.filter(r => r.no_show).length}`);
  console.log(`Reschedules: ${records.filter(r => r.rescheduled).length}`);
  console.log(`Follow-ups: ${records.filter(r => r.is_follow_up).length}`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
