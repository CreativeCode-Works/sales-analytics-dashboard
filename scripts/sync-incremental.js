#!/usr/bin/env node
/**
 * Incremental sync - pulls only contacts updated since last sync
 * Run via cron every 15 minutes: */15 * * * * node ~/c/dashboard/scripts/sync-incremental.js
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
  if (!res.ok) throw new Error(`AC API error: ${res.status}`);
  return res.json();
}

function parseContact(contact, fieldValues) {
  const fields = {};
  for (const fv of fieldValues) {
    const key = FIELD_MAP[parseInt(fv.field)];
    if (!key) continue;
    const val = fv.value;
    if (['quiz_taken','masterclass_taken'].includes(key)) fields[key] = val === 'Taken';
    else if (['smd_purchased','rise_purchased','bundle_purchased'].includes(key)) fields[key] = val === 'Yes' || val === 'YES';
    else if (val && val.trim()) fields[key] = val;
  }
  return {
    id: String(contact.id), email: contact.email || null,
    first_name: contact.firstName || null, last_name: contact.lastName || null,
    phone: contact.phone || null, created_at: contact.cdate || null,
    updated_at: contact.udate || null, ac_updated: contact.udate || null,
    quiz_taken: fields.quiz_taken || false, masterclass_taken: fields.masterclass_taken || false,
    smd_purchased: fields.smd_purchased || false, rise_purchased: fields.rise_purchased || false,
    bundle_purchased: fields.bundle_purchased || false,
    amount_paid: fields.amount_paid || null, date_paid: fields.date_paid || null,
    most_recent_purchase: fields.most_recent_purchase || null,
    y2_amount_paid: fields.y2_amount_paid || null, y2_date_paid: fields.y2_date_paid || null,
    program_start: fields.program_start || null, program_end: fields.program_end || null,
    lead_source: fields.lead_source || null, utm_source: fields.utm_source || null,
    setter: fields.setter || null, closer: fields.closer || null,
    call_scheduled_by: fields.call_scheduled_by || null,
    current_discovery_call: fields.current_discovery_call || null,
    most_recent_discovery_call: fields.most_recent_discovery_call || null,
    confirmed_discovery_call: fields.confirmed_discovery_call || null,
    opt_in_status: fields.opt_in_status || null, podcast_only: fields.podcast_only || null,
    is_coaching_track: fields.is_coaching_track || null, independent_study: fields.independent_study || null,
    synced_at: new Date().toISOString(),
  };
}

async function getLastSyncTime() {
  const { data } = await supabase
    .from('sync_log')
    .select('completed_at')
    .eq('status', 'success')
    .order('id', { ascending: false })
    .limit(1);

  if (data?.[0]?.completed_at) {
    return new Date(data[0].completed_at);
  }
  // Default to 1 hour ago if no successful sync
  return new Date(Date.now() - 60 * 60 * 1000);
}

async function run() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting incremental sync...`);

  // Get last sync time
  const lastSync = await getLastSyncTime();
  const updatedAfter = lastSync.toISOString().replace('T', ' ').split('.')[0];
  console.log(`Fetching contacts updated after: ${updatedAfter}`);

  // Log sync start
  const { data: syncRun } = await supabase
    .from('sync_log')
    .insert({ sync_type: 'incremental', status: 'running' })
    .select()
    .single();

  let offset = 0;
  const limit = 100;
  let totalProcessed = 0;
  let errors = 0;

  while (true) {
    try {
      // Use filters[updated_after] to get only recently updated contacts
      const data = await fetchAC(`/contacts?limit=${limit}&offset=${offset}&filters[updated_after]=${encodeURIComponent(updatedAfter)}`);

      const contacts = data.contacts || [];
      if (contacts.length === 0) break;

      const batch = contacts.map(c => parseContact(c, c.fieldValues || []));
      const { error } = await supabase.from('contacts').upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error('Upsert error:', error.message);
        errors++;
      } else {
        totalProcessed += batch.length;
      }

      offset += contacts.length;
      console.log(`Processed ${totalProcessed} updated contacts...`);

      if (contacts.length < limit) break;
      await sleep(250);
    } catch (err) {
      console.error('Error:', err.message);
      errors++;
      break;
    }
  }

  const endTime = new Date();
  const duration = (endTime - startTime) / 1000;

  // Get current DB count
  const { count: dbTotal } = await supabase.from('contacts').select('*', { count: 'exact', head: true });

  // Update sync log
  await supabase
    .from('sync_log')
    .update({
      completed_at: endTime.toISOString(),
      contacts_processed: totalProcessed,
      contacts_updated: totalProcessed,
      errors,
      db_total: dbTotal,
      status: errors > 0 ? 'error' : 'success',
    })
    .eq('id', syncRun.id);

  console.log(`\nIncremental sync complete:`);
  console.log(`  Updated: ${totalProcessed} contacts`);
  console.log(`  DB total: ${dbTotal}`);
  console.log(`  Duration: ${duration.toFixed(1)}s`);
  console.log(`  Errors: ${errors}`);
}

run().catch(console.error);
