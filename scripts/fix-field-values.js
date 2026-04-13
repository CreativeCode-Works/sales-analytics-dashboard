#!/usr/bin/env node
/**
 * Quick fix: re-fetch field values for contacts that have all false/null fields.
 * Only fetches /contacts/{id}/fieldValues — no notes, tags, deals, etc.
 * Much faster than a full re-sync.
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AC_KEY = process.env.AC_KEY;
const AC_BASE = process.env.AC_BASE;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FIELD_MAP = {
  131: 'quiz_taken', 132: 'masterclass_taken', 136: 'smd_purchased',
  137: 'rise_purchased', 138: 'bundle_purchased', 15: 'amount_paid',
  16: 'date_paid', 139: 'most_recent_purchase', 69: 'y2_amount_paid',
  70: 'y2_date_paid', 89: 'program_start', 149: 'program_end',
  33: 'lead_source', 44: 'utm_source', 45: 'setter', 36: 'closer',
  90: 'call_scheduled_by', 75: 'current_discovery_call',
  32: 'most_recent_discovery_call', 35: 'confirmed_discovery_call',
  74: 'opt_in_status', 95: 'podcast_only', 99: 'is_coaching_track', 106: 'independent_study',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAC(path) {
  const res = await fetch(`${AC_BASE}${path}`, { headers: { 'Api-Token': AC_KEY } });
  if (!res.ok) {
    if (res.status === 429) { await sleep(2000); return fetchAC(path); }
    throw new Error(`AC API ${res.status}: ${path}`);
  }
  return res.json();
}

async function run() {
  // Get all contacts — we'll update field values for all of them
  // Fetch in pages from Supabase
  let allContacts = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    allContacts.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  // Optional: filter to only contacts with --days arg
  const args = process.argv.slice(2);
  const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  const days = getArg('--days') ? parseInt(getArg('--days')) : null;

  if (days) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    // Re-fetch with date filter
    allContacts = [];
    from = 0;
    while (true) {
      const { data } = await supabase
        .from('contacts')
        .select('id, created_at')
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      allContacts.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    console.log(`Fixing field values for ${allContacts.length} contacts (last ${days} days)`);
  } else {
    console.log(`Fixing field values for ${allContacts.length} contacts (all)`);
  }

  let updated = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const contact of allContacts) {
    try {
      const data = await fetchAC(`/contacts/${contact.id}/fieldValues`);
      const fieldValues = data.fieldValues || [];

      const fields = {};
      for (const fv of fieldValues) {
        const key = FIELD_MAP[parseInt(fv.field)];
        if (!key) continue;
        const val = fv.value;
        if (['quiz_taken', 'masterclass_taken'].includes(key)) fields[key] = val === 'Taken';
        else if (['smd_purchased', 'rise_purchased', 'bundle_purchased'].includes(key)) fields[key] = val === 'Yes' || val === 'YES';
        else if (val && val.trim()) fields[key] = val;
      }

      const update = {
        quiz_taken: fields.quiz_taken || false,
        masterclass_taken: fields.masterclass_taken || false,
        smd_purchased: fields.smd_purchased || false,
        rise_purchased: fields.rise_purchased || false,
        bundle_purchased: fields.bundle_purchased || false,
        amount_paid: fields.amount_paid || null,
        date_paid: fields.date_paid || null,
        most_recent_purchase: fields.most_recent_purchase || null,
        y2_amount_paid: fields.y2_amount_paid || null,
        y2_date_paid: fields.y2_date_paid || null,
        program_start: fields.program_start || null,
        program_end: fields.program_end || null,
        lead_source: fields.lead_source || null,
        utm_source: fields.utm_source || null,
        setter: fields.setter || null,
        closer: fields.closer || null,
        call_scheduled_by: fields.call_scheduled_by || null,
        current_discovery_call: fields.current_discovery_call || null,
        most_recent_discovery_call: fields.most_recent_discovery_call || null,
        confirmed_discovery_call: fields.confirmed_discovery_call || null,
        opt_in_status: fields.opt_in_status || null,
        podcast_only: fields.podcast_only || null,
        is_coaching_track: fields.is_coaching_track || null,
        independent_study: fields.independent_study || null,
        synced_at: new Date().toISOString(),
      };

      await supabase.from('contacts').update(update).eq('id', contact.id);
      updated++;

      if (updated % 25 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (updated / (elapsed / 60)).toFixed(1);
        console.log(`  [${elapsed}s] ${updated}/${allContacts.length} | ${rate}/min`);
      }

      await sleep(200); // Rate limit
    } catch (e) {
      console.error(`  Error on ${contact.id}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${errors} errors, ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

run().catch(e => { console.error(e); process.exit(1); });
