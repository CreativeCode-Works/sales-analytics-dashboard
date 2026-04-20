require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AC_KEY = process.env.AC_KEY;
const AC_BASE = process.env.AC_BASE;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// AC custom field IDs we care about
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAC(path) {
  const res = await fetch(`${AC_BASE}${path}`, {
    headers: { 'Api-Token': AC_KEY }
  });
  if (!res.ok) throw new Error(`AC API error: ${res.status} ${path}`);
  return res.json();
}

function parseContact(contact, fieldValues) {
  const fields = {};
  
  for (const fv of fieldValues) {
    const fieldId = parseInt(fv.field);
    const key = FIELD_MAP[fieldId];
    if (!key) continue;
    
    const val = fv.value;
    
    // Boolean fields
    if (['quiz_taken', 'masterclass_taken'].includes(key)) {
      fields[key] = val === 'Taken';
    } else if (['smd_purchased', 'rise_purchased', 'bundle_purchased'].includes(key)) {
      fields[key] = val && val.toLowerCase().includes('yes');
    } else if (val && val.trim() !== '') {
      fields[key] = val;
    }
  }

  return {
    id: String(contact.id), email: contact.email || null,
    first_name: contact.firstName || null, last_name: contact.lastName || null,
    phone: contact.phone || null, created_at: contact.cdate || null,
    updated_at: contact.udate || null, ac_updated: contact.udate || null,
    quiz_taken: fields.quiz_taken || false, masterclass_taken: fields.masterclass_taken || false,
    masterclass_cta: fields.masterclass_cta || null,
    smd_purchased: fields.smd_purchased || false, rise_purchased: fields.rise_purchased || false,
    bundle_purchased: fields.bundle_purchased || false,
    amount_paid: fields.amount_paid || null, date_paid: fields.date_paid || null,
    most_recent_purchase: fields.most_recent_purchase || null,
    date_purchased: fields.date_purchased || null, last_product_purchased: fields.last_product_purchased || null,
    y2_amount_paid: fields.y2_amount_paid || null, y2_date_paid: fields.y2_date_paid || null,
    y2_program_end_date: fields.y2_program_end_date || null,
    program_start: fields.program_start || null, program_end: fields.program_end || null,
    iso_start_date: fields.iso_start_date || null, program_end_date: fields.program_end_date || null,
    embodiment_amount_paid: fields.embodiment_amount_paid || null, first_call_date: fields.first_call_date || null,
    lead_source: fields.lead_source || null, utm_source: fields.utm_source || null,
    setter: fields.setter || null, closer: fields.closer || null,
    call_scheduled_by: fields.call_scheduled_by || null,
    current_discovery_call: fields.current_discovery_call || null,
    most_recent_discovery_call: fields.most_recent_discovery_call || null,
    confirmed_discovery_call: fields.confirmed_discovery_call || null,
    opt_in_status: fields.opt_in_status || null, podcast_only: fields.podcast_only || null,
    is_coaching_track: fields.is_coaching_track || null, independent_study: fields.independent_study || null,
    progress: fields.progress || null, email_stage: fields.email_stage || null,
    why_now: fields.why_now || null, community_preference: fields.community_preference || null,
    investment_readiness: fields.investment_readiness || null, decision_maker: fields.decision_maker || null,
    anything_else: fields.anything_else || null,
    type_of_drinker: fields.type_of_drinker || null,
    quiz_night_off: fields.quiz_night_off || null, quiz_head_sounds: fields.quiz_head_sounds || null,
    quiz_first_drink: fields.quiz_first_drink || null, quiz_conversation: fields.quiz_conversation || null,
    quiz_cut_back: fields.quiz_cut_back || null, quiz_where_are_you: fields.quiz_where_are_you || null,
    quiz_worries: fields.quiz_worries || null, quiz_appealing: fields.quiz_appealing || null,
    country: fields.country || null,
    synced_at: new Date().toISOString(),
  };
}

async function syncContacts() {
  console.log('Starting full contact sync...');
  
  // Log sync start
  const { data: syncRun } = await supabase
    .from('sync_log')
    .insert({ sync_type: 'full', status: 'running' })
    .select()
    .single();

  let offset = 0;
  const limit = 100;
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let errors = 0;
  let acTotal = 0;

  while (true) {
    try {
      const data = await fetchAC(`/contacts?limit=${limit}&offset=${offset}&orders[]=cdate`);
      
      if (offset === 0) {
        acTotal = parseInt(data.meta?.total || 0);
        console.log(`AC total contacts: ${acTotal}`);
      }

      const contacts = data.contacts || [];
      if (contacts.length === 0) break;

      // Build batch of parsed contacts
      const batch = [];
      for (const contact of contacts) {
        try {
          const fieldValues = contact.fieldValues || [];
          const parsed = parseContact(contact, fieldValues);
          batch.push(parsed);
        } catch (err) {
          console.error(`Error parsing contact ${contact.id}:`, err.message);
          errors++;
        }
      }

      // Upsert batch to Supabase
      if (batch.length > 0) {
        const { error } = await supabase
          .from('contacts')
          .upsert(batch, { onConflict: 'id' });
        
        if (error) {
          console.error('Supabase upsert error:', error.message);
          errors++;
        } else {
          totalProcessed += batch.length;
          totalCreated += batch.length; // simplified for initial sync
        }
      }

      offset += contacts.length;
      console.log(`Synced ${offset}/${acTotal} contacts...`);

      if (contacts.length < limit) break;
      
      // Respect AC rate limit: 5 req/sec
      await sleep(250);

    } catch (err) {
      console.error(`Error at offset ${offset}:`, err.message);
      errors++;
      await sleep(1000);
      break;
    }
  }

  // Get DB total for drift check
  const { count: dbTotal } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true });

  const delta = acTotal - (dbTotal || 0);
  
  console.log(`\nSync complete:`);
  console.log(`  AC total: ${acTotal}`);
  console.log(`  DB total: ${dbTotal}`);
  console.log(`  Delta: ${delta}`);
  console.log(`  Errors: ${errors}`);

  if (Math.abs(delta) > acTotal * 0.01) {
    console.warn(`⚠️  DRIFT DETECTED: delta of ${delta} exceeds 1% threshold`);
  }

  // Update sync log
  await supabase
    .from('sync_log')
    .update({
      completed_at: new Date().toISOString(),
      contacts_processed: totalProcessed,
      contacts_created: totalCreated,
      contacts_updated: totalUpdated,
      errors,
      ac_total: acTotal,
      db_total: dbTotal,
      delta,
      status: errors > 0 ? 'error' : 'success',
    })
    .eq('id', syncRun.id);

  console.log('Done.');
}

syncContacts().catch(console.error);
