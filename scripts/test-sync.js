require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AC_KEY = process.env.AC_KEY;
const AC_BASE = process.env.AC_BASE;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FIELD_MAP = {
  131: 'quiz_taken',
  132: 'masterclass_taken',
  136: 'smd_purchased',
  137: 'rise_purchased',
  138: 'bundle_purchased',
  15: 'amount_paid',
  45: 'setter',
  36: 'closer',
  75: 'current_discovery_call',
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
