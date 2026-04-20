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
  // Program Dates (CORRECTED)
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

async function fetchAC(path) {
  const res = await fetch(AC_BASE + path, { headers: { 'Api-Token': AC_KEY } });
  return res.json();
}

async function run() {
  // Test with 10 contacts
  const data = await fetchAC('/contacts?limit=10');

  let quizCount = 0;
  let mcCount = 0;

  for (const c of data.contacts) {
    const fvData = await fetchAC('/contacts/' + c.id + '/fieldValues');
    const fields = {};

    for (const fv of fvData.fieldValues || []) {
      const key = FIELD_MAP[parseInt(fv.field)];
      if (!key) continue;
      if (['quiz_taken', 'masterclass_taken'].includes(key)) {
        fields[key] = fv.value === 'Taken';
      } else if (['smd_purchased', 'rise_purchased', 'bundle_purchased'].includes(key)) {
        fields[key] = fv.value === 'Yes' || fv.value === 'YES';
      } else {
        fields[key] = fv.value;
      }
    }

    if (fields.quiz_taken) quizCount++;
    if (fields.masterclass_taken) mcCount++;

    console.log(c.id, c.email.substring(0, 25).padEnd(25), 'Quiz:', fields.quiz_taken || false, 'MC:', fields.masterclass_taken || false);

    // Update in Supabase
    const { error } = await supabase.from('contacts').update({
      quiz_taken: fields.quiz_taken || false,
      masterclass_taken: fields.masterclass_taken || false,
      smd_purchased: fields.smd_purchased || false,
      rise_purchased: fields.rise_purchased || false,
      bundle_purchased: fields.bundle_purchased || false,
      amount_paid: fields.amount_paid || null,
      setter: fields.setter || null,
      closer: fields.closer || null,
      current_discovery_call: fields.current_discovery_call || null,
      synced_at: new Date().toISOString()
    }).eq('id', String(c.id));

    if (error) console.error('Update error:', error.message);
  }

  console.log('\nUpdated 10 contacts. Quiz:', quizCount, 'MC:', mcCount);
}

run().catch(console.error);
