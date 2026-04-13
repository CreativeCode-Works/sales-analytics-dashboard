#!/usr/bin/env node
/**
 * Sync JustCall calls and texts — for cross-referencing with AC notes data.
 *
 * Usage:
 *   node scripts/sync-justcall.js                # Last 30 days
 *   node scripts/sync-justcall.js --days 7       # Last 7 days
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JC_KEY = process.env.JUSTCALL_API_KEY;
const JC_SECRET = process.env.JUSTCALL_API_SECRET;

if (!SUPABASE_URL || !SUPABASE_KEY || !JC_KEY || !JC_SECRET) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_KEY, JUSTCALL_API_KEY, JUSTCALL_API_SECRET');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const DAYS = getArg('--days') ? parseInt(getArg('--days')) : 30;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJC(endpoint, params = {}) {
  const url = new URL(`https://api.justcall.io/v1${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Authorization': `${JC_KEY}:${JC_SECRET}`,
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`JustCall API ${res.status}: ${endpoint} — ${text.substring(0, 200)}`);
  }
  return res.json();
}

// Normalize phone: strip everything except digits, keep last 10
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

async function run() {
  const startTime = Date.now();
  console.log(`=== JustCall Sync (last ${DAYS} days) ===`);

  // Build phone→contact_id lookup
  const { data: contactLookup } = await supabase.from('contacts').select('id, phone');
  const phoneToId = {};
  for (const c of (contactLookup || [])) {
    if (c.phone) {
      const norm = normalizePhone(c.phone);
      if (norm) phoneToId[norm] = c.id;
    }
  }
  console.log(`Loaded ${Object.keys(phoneToId).length} phone→contact mappings`);

  const startDate = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = new Date().toISOString().split('T')[0];

  // ========== CALLS ==========
  console.log('\nFetching calls...');
  let allCalls = [];
  let page = 1;

  while (true) {
    try {
      const data = await fetchJC('/calls/list', {
        start_date: startStr,
        end_date: endStr,
        per_page: 100,
        page,
      });

      const calls = data.data || [];
      if (calls.length === 0) break;
      allCalls = allCalls.concat(calls);
      console.log(`  Page ${page}: ${calls.length} calls (total: ${allCalls.length})`);

      if (calls.length < 100) break;
      page++;
      await sleep(500); // JustCall rate limit
    } catch (e) {
      console.error(`  Calls error page ${page}: ${e.message}`);
      break;
    }
  }

  // Map calls to records
  const callRecords = allCalls.map(call => {
    const contactPhone = normalizePhone(call.contact_number || call.customer_number || '');
    return {
      id: String(call.id),
      contact_phone: call.contact_number || call.customer_number || '',
      contact_name: call.contact_name || null,
      direction: call.direction || (call.type === 'outgoing' ? 'outbound' : 'inbound'),
      status: call.status || call.disposition || 'unknown',
      duration: call.duration ? parseInt(call.duration) : 0,
      recording_url: call.recording_url || null,
      agent_name: call.agent_name || null,
      agent_number: call.justcall_number || null,
      contact_number: call.contact_number || call.customer_number || '',
      called_at: call.datetime || call.created_at || null,
      contact_id: phoneToId[contactPhone] || null,
      synced_at: new Date().toISOString(),
    };
  });

  if (callRecords.length > 0) {
    for (let i = 0; i < callRecords.length; i += 50) {
      const { error } = await supabase.from('justcall_calls').upsert(callRecords.slice(i, i + 50), { onConflict: 'id' });
      if (error) console.error('Call upsert error:', error.message);
    }
  }
  console.log(`Synced ${callRecords.length} calls`);

  // ========== TEXTS ==========
  console.log('\nFetching texts...');
  let allTexts = [];
  page = 1;

  while (true) {
    try {
      const data = await fetchJC('/texts/list', {
        start_date: startStr,
        end_date: endStr,
        per_page: 100,
        page,
      });

      const texts = data.data || [];
      if (texts.length === 0) break;
      allTexts = allTexts.concat(texts);
      console.log(`  Page ${page}: ${texts.length} texts (total: ${allTexts.length})`);

      if (texts.length < 100) break;
      page++;
      await sleep(500);
    } catch (e) {
      console.error(`  Texts error page ${page}: ${e.message}`);
      break;
    }
  }

  // Map texts to records
  const textRecords = allTexts.map(text => {
    const contactPhone = normalizePhone(text.contact_number || text.customer_number || '');
    return {
      id: String(text.id),
      contact_phone: text.contact_number || text.customer_number || '',
      direction: text.direction || (text.type === 'outgoing' ? 'outbound' : 'inbound'),
      body: text.body || text.content || '',
      agent_name: text.agent_name || null,
      agent_number: text.justcall_number || null,
      contact_number: text.contact_number || text.customer_number || '',
      sent_at: text.datetime || text.created_at || null,
      contact_id: phoneToId[contactPhone] || null,
      synced_at: new Date().toISOString(),
    };
  });

  if (textRecords.length > 0) {
    for (let i = 0; i < textRecords.length; i += 50) {
      const { error } = await supabase.from('justcall_texts').upsert(textRecords.slice(i, i + 50), { onConflict: 'id' });
      if (error) console.error('Text upsert error:', error.message);
    }
  }
  console.log(`Synced ${textRecords.length} texts`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== JustCall Sync Complete ===`);
  console.log(`Duration: ${elapsed}s`);
  console.log(`Calls: ${callRecords.length} (${callRecords.filter(c => c.contact_id).length} matched to contacts)`);
  console.log(`Texts: ${textRecords.length} (${textRecords.filter(t => t.contact_id).length} matched to contacts)`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
