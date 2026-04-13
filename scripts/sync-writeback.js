#!/usr/bin/env node
/**
 * AC Writeback — pushes queued dashboard actions to ActiveCampaign.
 * Processes: deal moves, notes, field updates.
 * Run at end of day or on-demand.
 *
 * Usage:
 *   node scripts/sync-writeback.js          # Process all pending actions
 *   node scripts/sync-writeback.js --dry    # Preview without writing to AC
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AC_KEY = process.env.AC_KEY;
const AC_BASE = process.env.AC_BASE;

if (!SUPABASE_URL || !SUPABASE_KEY || !AC_KEY || !AC_BASE) {
  console.error('Missing required env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function acRequest(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${AC_BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AC API ${res.status} ${method} ${path}: ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function processMoveDeal(action) {
  const { deal_id, new_status, new_stage_id, new_group_id } = action.payload;

  const updateBody = { deal: {} };
  if (new_status !== undefined) updateBody.deal.status = new_status;
  if (new_stage_id) updateBody.deal.stage = new_stage_id;
  if (new_group_id) updateBody.deal.group = new_group_id;

  if (DRY_RUN) {
    console.log(`  [DRY] Would update deal ${deal_id}:`, updateBody);
    return;
  }

  await acRequest('PUT', `/deals/${deal_id}`, updateBody);
  console.log(`  Updated deal ${deal_id}: status=${new_status || 'unchanged'}, stage=${new_stage_id || 'unchanged'}`);
}

async function processAddNote(action) {
  const { note_text } = action.payload;
  const contactId = action.contact_id;

  if (DRY_RUN) {
    console.log(`  [DRY] Would add note to contact ${contactId}: "${note_text.substring(0, 50)}..."`);
    return;
  }

  await acRequest('POST', '/notes', {
    note: {
      note: note_text,
      relid: parseInt(contactId),
      reltype: 'Subscriber',
    }
  });
  console.log(`  Added note to contact ${contactId}: "${note_text.substring(0, 50)}..."`);
}

async function run() {
  console.log(`=== AC Writeback ${DRY_RUN ? '(DRY RUN)' : ''} ===`);

  // Fetch all pending actions
  const { data: actions, error } = await supabase
    .from('dashboard_actions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching actions:', error.message);
    process.exit(1);
  }

  console.log(`Pending actions: ${actions.length}`);

  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      console.log(`\nProcessing: ${action.action_type} for contact ${action.contact_id}`);

      if (action.action_type === 'move_deal') {
        await processMoveDeal(action);
      } else if (action.action_type === 'add_note') {
        await processAddNote(action);
      } else {
        console.log(`  Unknown action type: ${action.action_type}`);
        continue;
      }

      // Mark as synced
      if (!DRY_RUN) {
        await supabase.from('dashboard_actions').update({
          status: 'synced',
          synced_at: new Date().toISOString(),
        }).eq('id', action.id);
      }

      synced++;
      await sleep(250); // Rate limit
    } catch (e) {
      console.error(`  Error: ${e.message}`);
      failed++;

      if (!DRY_RUN) {
        await supabase.from('dashboard_actions').update({
          status: 'failed',
          error_message: e.message,
        }).eq('id', action.id);
      }
    }
  }

  console.log(`\n=== Writeback Complete ===`);
  console.log(`Synced: ${synced}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining pending: ${actions.length - synced - failed}`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
