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
  // Lead Magnet Progress
  131: 'quiz_taken', 132: 'masterclass_taken', 148: 'masterclass_cta',
  // LTO Purchasers
  136: 'smd_purchased', 137: 'rise_purchased', 138: 'bundle_purchased',
  // Payment & Dates
  15: 'amount_paid', 16: 'date_paid', 139: 'most_recent_purchase',
  145: 'date_purchased', 146: 'last_product_purchased',
  69: 'y2_amount_paid', 70: 'y2_date_paid', 147: 'y2_program_end_date',
  // Program Dates (CORRECTED: was 89→program_start, 149→program_end)
  87: 'program_start', 88: 'program_end', 89: 'iso_start_date', 149: 'program_end_date',
  // Embodiment Track
  98: 'embodiment_amount_paid', 86: 'first_call_date',
  // Attribution
  33: 'lead_source', 44: 'utm_source', 45: 'setter', 36: 'closer', 90: 'call_scheduled_by',
  // Discovery Calls
  75: 'current_discovery_call', 32: 'most_recent_discovery_call', 35: 'confirmed_discovery_call',
  // Status
  74: 'opt_in_status', 95: 'podcast_only', 99: 'is_coaching_track', 106: 'independent_study',
  127: 'progress', 150: 'email_stage',
  // Booking Form
  121: 'why_now', 122: 'community_preference', 123: 'investment_readiness',
  124: 'decision_maker', 125: 'anything_else',
  // Quiz Responses
  126: 'type_of_drinker', 111: 'quiz_night_off', 112: 'quiz_head_sounds',
  113: 'quiz_first_drink', 114: 'quiz_conversation', 115: 'quiz_cut_back',
  116: 'quiz_where_are_you', 117: 'quiz_worries', 118: 'quiz_appealing',
  // Location
  42: 'country',
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
        else if (['smd_purchased', 'rise_purchased', 'bundle_purchased'].includes(key)) fields[key] = val && val.toLowerCase().includes('yes');
        else if (val && val.trim()) fields[key] = val;
      }

      // Also check tags in Supabase (AC automation doesn't always set the field)
      if (!fields.quiz_taken || !fields.masterclass_taken) {
        const { data: tags } = await supabase.from('contact_tags').select('tag_name').eq('contact_id', contact.id);
        const tagNames = (tags || []).map(t => (t.tag_name || '').toLowerCase());
        if (!fields.quiz_taken && tagNames.some(t => t === 'takeitorleaveit-quiz')) fields.quiz_taken = true;
        if (!fields.masterclass_taken && tagNames.some(t => t.includes('masterclass'))) fields.masterclass_taken = true;
      }

      const update = {
        // Lead Magnet
        quiz_taken: fields.quiz_taken || false,
        masterclass_taken: fields.masterclass_taken || false,
        masterclass_cta: fields.masterclass_cta || null,
        // Purchases
        smd_purchased: fields.smd_purchased || false,
        rise_purchased: fields.rise_purchased || false,
        bundle_purchased: fields.bundle_purchased || false,
        amount_paid: fields.amount_paid || null,
        date_paid: fields.date_paid || null,
        most_recent_purchase: fields.most_recent_purchase || null,
        date_purchased: fields.date_purchased || null,
        last_product_purchased: fields.last_product_purchased || null,
        y2_amount_paid: fields.y2_amount_paid || null,
        y2_date_paid: fields.y2_date_paid || null,
        y2_program_end_date: fields.y2_program_end_date || null,
        // Program Dates
        program_start: fields.program_start || null,
        program_end: fields.program_end || null,
        iso_start_date: fields.iso_start_date || null,
        program_end_date: fields.program_end_date || null,
        // Embodiment
        embodiment_amount_paid: fields.embodiment_amount_paid || null,
        first_call_date: fields.first_call_date || null,
        // Attribution
        lead_source: fields.lead_source || null,
        utm_source: fields.utm_source || null,
        setter: fields.setter || null,
        closer: fields.closer || null,
        call_scheduled_by: fields.call_scheduled_by || null,
        // Discovery Calls
        current_discovery_call: fields.current_discovery_call || null,
        most_recent_discovery_call: fields.most_recent_discovery_call || null,
        confirmed_discovery_call: fields.confirmed_discovery_call || null,
        // Status
        opt_in_status: fields.opt_in_status || null,
        podcast_only: fields.podcast_only || null,
        is_coaching_track: fields.is_coaching_track || null,
        independent_study: fields.independent_study || null,
        progress: fields.progress || null,
        email_stage: fields.email_stage || null,
        // Booking Form
        why_now: fields.why_now || null,
        community_preference: fields.community_preference || null,
        investment_readiness: fields.investment_readiness || null,
        decision_maker: fields.decision_maker || null,
        anything_else: fields.anything_else || null,
        // Quiz Responses
        type_of_drinker: fields.type_of_drinker || null,
        quiz_night_off: fields.quiz_night_off || null,
        quiz_head_sounds: fields.quiz_head_sounds || null,
        quiz_first_drink: fields.quiz_first_drink || null,
        quiz_conversation: fields.quiz_conversation || null,
        quiz_cut_back: fields.quiz_cut_back || null,
        quiz_where_are_you: fields.quiz_where_are_you || null,
        quiz_worries: fields.quiz_worries || null,
        quiz_appealing: fields.quiz_appealing || null,
        // Location
        country: fields.country || null,
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
