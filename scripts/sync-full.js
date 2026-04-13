#!/usr/bin/env node
/**
 * Full Expanded Sync — pulls ALL AC data for each contact:
 *   - Contact fields (existing)
 *   - Notes (contact + deal) → parsed for JustCall SMS/calls
 *   - Tags (current, with names)
 *   - Automations (with names and status)
 *   - Deals (with pipeline/stage names)
 *   - Email activities (opens, clicks)
 *   - Contact logs (tag add/remove history)
 *   - Builds unified timeline_events server-side
 *
 * Usage:
 *   node scripts/sync-full.js                   # Sync all contacts
 *   node scripts/sync-full.js --limit 10        # Test with 10 contacts
 *   node scripts/sync-full.js --offset 500      # Resume from offset
 *   node scripts/sync-full.js --contact 12345   # Single contact
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AC_KEY = process.env.AC_KEY;
const AC_BASE = process.env.AC_BASE;

if (!SUPABASE_URL || !SUPABASE_KEY || !AC_KEY || !AC_BASE) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_KEY, AC_KEY, AC_BASE');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CLI args
const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const LIMIT_CONTACTS = getArg('--limit') ? parseInt(getArg('--limit')) : null;
const START_OFFSET = getArg('--offset') ? parseInt(getArg('--offset')) : 0;
const SINGLE_CONTACT = getArg('--contact');
const DAYS = getArg('--days') ? parseInt(getArg('--days')) : null;

// AC custom field mapping (same as existing sync.js)
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

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let requestCount = 0;
async function fetchAC(path) {
  requestCount++;
  const res = await fetch(`${AC_BASE}${path}`, { headers: { 'Api-Token': AC_KEY } });
  if (!res.ok) {
    if (res.status === 429) {
      console.warn('  Rate limited, waiting 2s...');
      await sleep(2000);
      return fetchAC(path);
    }
    throw new Error(`AC API ${res.status}: ${path}`);
  }
  return res.json();
}

// Caches for lookup tables (tag names, automation names, stages, pipelines)
const tagCache = {};
const automationCache = {};
const stageCache = {};
const pipelineCache = {};

async function getTagName(tagId) {
  if (tagCache[tagId]) return tagCache[tagId];
  try {
    const data = await fetchAC(`/tags/${tagId}`);
    const name = data.tag?.tag || `Tag ${tagId}`;
    tagCache[tagId] = name;
    // Cache to Supabase
    await supabase.from('tag_lookup').upsert({ id: String(tagId), name, synced_at: new Date().toISOString() }, { onConflict: 'id' });
    await sleep(50);
    return name;
  } catch (e) {
    tagCache[tagId] = `Tag ${tagId}`;
    return tagCache[tagId];
  }
}

async function getAutomationName(autoId) {
  if (automationCache[autoId]) return automationCache[autoId];
  try {
    const data = await fetchAC(`/automations/${autoId}`);
    const name = data.automation?.name || `Automation ${autoId}`;
    automationCache[autoId] = name;
    await supabase.from('automation_lookup').upsert({ id: String(autoId), name, synced_at: new Date().toISOString() }, { onConflict: 'id' });
    await sleep(50);
    return name;
  } catch (e) {
    automationCache[autoId] = `Automation ${autoId}`;
    return automationCache[autoId];
  }
}

async function getStageName(stageId) {
  if (stageCache[stageId]) return stageCache[stageId];
  try {
    const data = await fetchAC(`/dealStages/${stageId}`);
    const title = data.dealStage?.title || 'Unknown Stage';
    const groupId = data.dealStage?.group || null;
    stageCache[stageId] = title;
    await supabase.from('deal_stage_lookup').upsert({ id: String(stageId), title, group_id: groupId, synced_at: new Date().toISOString() }, { onConflict: 'id' });
    await sleep(50);
    return title;
  } catch (e) {
    stageCache[stageId] = 'Unknown Stage';
    return stageCache[stageId];
  }
}

async function getPipelineName(groupId) {
  if (pipelineCache[groupId]) return pipelineCache[groupId];
  try {
    const data = await fetchAC(`/dealGroups/${groupId}`);
    const title = data.dealGroup?.title || 'Unknown Pipeline';
    pipelineCache[groupId] = title;
    await supabase.from('deal_pipeline_lookup').upsert({ id: String(groupId), title, synced_at: new Date().toISOString() }, { onConflict: 'id' });
    await sleep(50);
    return title;
  } catch (e) {
    pipelineCache[groupId] = 'Unknown Pipeline';
    return pipelineCache[groupId];
  }
}

// ============================================================================
// LOAD CACHED LOOKUPS FROM SUPABASE (avoid re-fetching on resume)
// ============================================================================

async function loadCaches() {
  const [tags, autos, stages, pipelines] = await Promise.all([
    supabase.from('tag_lookup').select('id, name'),
    supabase.from('automation_lookup').select('id, name'),
    supabase.from('deal_stage_lookup').select('id, title'),
    supabase.from('deal_pipeline_lookup').select('id, title'),
  ]);
  for (const t of (tags.data || [])) tagCache[t.id] = t.name;
  for (const a of (autos.data || [])) automationCache[a.id] = a.name;
  for (const s of (stages.data || [])) stageCache[s.id] = s.title;
  for (const p of (pipelines.data || [])) pipelineCache[p.id] = p.title;
  console.log(`Loaded caches: ${Object.keys(tagCache).length} tags, ${Object.keys(automationCache).length} automations, ${Object.keys(stageCache).length} stages, ${Object.keys(pipelineCache).length} pipelines`);
}

// ============================================================================
// CONTACT FIELD PARSING (same as existing sync.js)
// ============================================================================

function parseContact(contact, fieldValues) {
  const fields = {};
  for (const fv of fieldValues) {
    const key = FIELD_MAP[parseInt(fv.field)];
    if (!key) continue;
    const val = fv.value;
    if (['quiz_taken', 'masterclass_taken'].includes(key)) fields[key] = val === 'Taken';
    else if (['smd_purchased', 'rise_purchased', 'bundle_purchased'].includes(key)) fields[key] = val === 'Yes' || val === 'YES';
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

// ============================================================================
// PER-CONTACT AC DATA FETCHERS
// ============================================================================

async function fetchContactNotes(contactId) {
  try {
    const data = await fetchAC(`/notes?filters[reltype]=Subscriber&filters[relid]=${contactId}&limit=100`);
    return (data.notes || []).map(n => ({
      id: String(n.id),
      contact_id: String(contactId),
      rel_type: 'Subscriber',
      rel_id: String(contactId),
      content: n.note,
      created_at: n.cdate,
      synced_at: new Date().toISOString(),
    }));
  } catch (e) {
    console.error(`  Notes error for ${contactId}: ${e.message}`);
    return [];
  }
}

async function fetchDealNotes(dealId, contactId) {
  try {
    const data = await fetchAC(`/notes?filters[reltype]=Deal&filters[relid]=${dealId}`);
    return (data.notes || []).map(n => ({
      id: String(n.id),
      contact_id: String(contactId),
      rel_type: 'Deal',
      rel_id: String(dealId),
      content: n.note,
      created_at: n.cdate,
      synced_at: new Date().toISOString(),
    }));
  } catch (e) {
    return [];
  }
}

async function fetchContactTags(contactId) {
  try {
    const data = await fetchAC(`/contacts/${contactId}/contactTags`);
    const contactTags = data.contactTags || [];
    const results = [];
    for (const ct of contactTags) {
      const name = await getTagName(ct.tag);
      results.push({
        id: String(ct.id),
        contact_id: String(contactId),
        tag_id: String(ct.tag),
        tag_name: name,
        added_at: ct.cdate,
        synced_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (e) {
    console.error(`  Tags error for ${contactId}: ${e.message}`);
    return [];
  }
}

async function fetchContactAutomations(contactId) {
  try {
    const data = await fetchAC(`/contacts/${contactId}/contactAutomations`);
    const autos = data.contactAutomations || [];
    const results = [];
    for (const a of autos) {
      const name = await getAutomationName(a.automation);
      const status = a.status === '1' ? 'Active' : a.status === '2' ? 'Completed' : 'Stopped';
      results.push({
        id: String(a.id),
        contact_id: String(contactId),
        automation_id: String(a.automation),
        automation_name: name,
        status,
        entered_at: a.adddate,
        completed_at: a.completedate || null,
        synced_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (e) {
    console.error(`  Automations error for ${contactId}: ${e.message}`);
    return [];
  }
}

async function fetchContactDeals(contactId) {
  try {
    const data = await fetchAC(`/deals?filters[contact]=${contactId}`);
    const deals = data.deals || [];
    const results = [];
    for (const d of deals) {
      const stage = d.stage ? await getStageName(d.stage) : 'Unknown Stage';
      const pipeline = d.group ? await getPipelineName(d.group) : 'Unknown Pipeline';
      const status = d.status === '0' ? 'Open' : d.status === '1' ? 'Won' : 'Lost';
      results.push({
        id: String(d.id),
        contact_id: String(contactId),
        title: d.title,
        value_cents: d.value ? parseInt(d.value) : null,
        pipeline,
        stage,
        status,
        created_at: d.cdate,
        modified_at: d.mdate,
        synced_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (e) {
    console.error(`  Deals error for ${contactId}: ${e.message}`);
    return [];
  }
}

async function fetchContactEmailActivities(contactId) {
  try {
    const data = await fetchAC(`/activities?filters[contact]=${contactId}&limit=100`);
    const all = data.activities || [];
    const emailActs = all.filter(a =>
      a.referenceModelName === 'link-data' || a.referenceModelName === 'mpp-link-data'
    );

    const results = [];
    for (const act of emailActs) {
      const isOpen = act.referenceModelName === 'mpp-link-data' || act.reference?.link === 'open';
      let campaignName = null;
      let linkUrl = null;
      let campaignId = null;

      if (act.reference?.id) {
        try {
          const linkData = await fetchAC(`/links/${act.reference.id}`);
          linkUrl = linkData.link?.link || null;
          campaignId = linkData.link?.campaignid || null;
          if (campaignId) {
            try {
              const campData = await fetchAC(`/campaigns/${campaignId}`);
              campaignName = campData.campaign?.name || null;
            } catch (e) {}
          }
          await sleep(30);
        } catch (e) {}
      }

      results.push({
        contact_id: String(contactId),
        activity_type: isOpen ? 'email_open' : 'email_click',
        timestamp: act.tstamp,
        campaign_id: campaignId ? String(campaignId) : null,
        campaign_name: campaignName,
        link_url: linkUrl,
        details: null,
        synced_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (e) {
    return [];
  }
}

async function fetchContactLogs(contactId) {
  try {
    const logs = [];
    let offset = 0;
    while (true) {
      const data = await fetchAC(`/contacts/${contactId}/contactLogs?limit=100&offset=${offset}`);
      const batch = data.contactLogs || [];
      logs.push(...batch);
      if (batch.length < 100) break;
      offset += 100;
      await sleep(100);
    }
    return logs;
  } catch (e) {
    return [];
  }
}

// ============================================================================
// JUSTCALL NOTE PARSING (ported from V1 report.js)
// ============================================================================

function parseSmsDateTime(dateStr) {
  try {
    const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
    let date = new Date(cleaned);
    if (!isNaN(date.getTime())) return date;

    const match = cleaned.match(/(\d+)\s+(\w+)\s+(\d{4}),?\s*(\d+):(\d+)(am|pm)?/i);
    if (match) {
      const [, day, month, year, hour, minute, ampm] = match;
      const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
      const monthNum = months[month.toLowerCase().substring(0, 3)];
      if (monthNum === undefined) return null;
      let hourNum = parseInt(hour);
      if (ampm?.toLowerCase() === 'pm' && hourNum !== 12) hourNum += 12;
      if (ampm?.toLowerCase() === 'am' && hourNum === 12) hourNum = 0;
      return new Date(parseInt(year), monthNum, parseInt(day), hourNum, parseInt(minute));
    }
    return null;
  } catch (e) { return null; }
}

function parseSmsFromNotes(notes) {
  const messages = [];
  for (const note of notes) {
    const content = note.content || '';
    const isIncoming = content.includes('Incoming SMS');
    const isOutgoing = content.includes('Outgoing SMS');
    if (!isIncoming && !isOutgoing) continue;

    if (isIncoming) {
      const smsIdMatch = content.match(/SMS ID:\s*(\d+)/i);
      const dateMatch = content.match(/Date & Time:\s*([^\n]+)/i);
      let timestamp = note.created_at;
      if (dateMatch) {
        const parsed = parseSmsDateTime(dateMatch[1].trim());
        if (parsed) timestamp = parsed.toISOString();
      }
      const fromMatch = content.match(/Received from:\s*(\+?\d+)/i);
      const toMatch = content.match(/Received on:[^(]*\(\s*(\+?\d+)\s*\)/i);
      const messageMatch = content.match(/Message:\s*([\s\S]*?)$/i);

      messages.push({
        type: 'SMS_INBOUND',
        sms_id: smsIdMatch ? smsIdMatch[1] : null,
        timestamp,
        from_phone: fromMatch ? fromMatch[1] : '',
        to_phone: toMatch ? toMatch[1] : '',
        message: messageMatch ? messageMatch[1].trim() : '',
        note_id: note.id,
      });
    } else {
      const messageMatch = content.match(/Outgoing SMS:?\s*([\s\S]*?)$/i);
      messages.push({
        type: 'SMS_OUTBOUND',
        sms_id: null,
        timestamp: note.created_at,
        from_phone: '',
        to_phone: '',
        message: messageMatch ? messageMatch[1].trim() : '',
        note_id: note.id,
      });
    }
  }
  return messages;
}

function parseCallsFromNotes(notes) {
  const calls = [];
  for (const note of notes) {
    const content = note.content || '';
    const lower = content.toLowerCase();

    const isIncoming = lower.includes('incoming call') || lower.includes('answered call');
    const isOutgoing = lower.includes('outgoing call');
    const isMissed = lower.includes('missed call') || lower.includes('unanswered call');
    const isVoicemail = lower.includes('voicemail');

    if (!isIncoming && !isOutgoing && !isMissed && !isVoicemail) continue;

    let callType = 'CALL';
    if (isMissed) callType = 'CALL_MISSED';
    else if (isVoicemail) callType = 'VOICEMAIL';
    else if (isIncoming) callType = 'CALL_INBOUND';
    else if (isOutgoing) callType = 'CALL_OUTBOUND';

    const callIdMatch = content.match(/Call ID:\s*(\d+)/i);
    const dateMatch = content.match(/Date & Time:\s*([^\n]+)/i);
    let timestamp = note.created_at;
    if (dateMatch) {
      const parsed = parseSmsDateTime(dateMatch[1].trim());
      if (parsed) timestamp = parsed.toISOString();
    }

    const fromMatch = content.match(/(?:From|Caller):\s*(\+?[\d\s-]+)/i);
    const toMatch = content.match(/(?:To|Called):\s*(\+?[\d\s-]+)/i);
    const receivedOnMatch = content.match(/Received on:[^(]*\(\s*(\+?\d+)\s*\)/i);
    const durationMatch = content.match(/Duration:\s*([^\n]+)/i);
    const recordingMatch = content.match(/Recording:\s*(https?:\/\/[^\s\n]+)/i);

    calls.push({
      type: callType,
      call_id: callIdMatch ? callIdMatch[1] : null,
      timestamp,
      from_phone: fromMatch ? fromMatch[1].trim() : '',
      to_phone: toMatch ? toMatch[1].trim() : (receivedOnMatch ? receivedOnMatch[1] : ''),
      duration: durationMatch ? durationMatch[1].trim() : null,
      recording: recordingMatch ? recordingMatch[1] : null,
      note_id: note.id,
    });
  }
  return calls;
}

function isJustCallNote(content) {
  const lower = (content || '').toLowerCase();
  return lower.includes('incoming sms') || lower.includes('outgoing sms') ||
         lower.includes('incoming call') || lower.includes('outgoing call') ||
         lower.includes('missed call') || lower.includes('voicemail') ||
         lower.includes('answered call') || lower.includes('unanswered call');
}

// ============================================================================
// TIMELINE BUILDER (ported from V1, runs server-side)
// ============================================================================

function buildTimeline(contactId, { contact, tags, automations, deals, emailActivities, notes, dealNotes, contactLogs, smsFromNotes, callsFromNotes }) {
  const events = [];
  const now = new Date().toISOString();

  // Contact created
  events.push({
    contact_id: contactId,
    timestamp: contact.cdate || contact.created_at,
    category: 'CONTACT',
    event: 'Contact Created',
    details: 'Added to ActiveCampaign',
    source: 'ActiveCampaign',
    source_id: `contact-created-${contactId}`,
    synced_at: now,
  });

  // Tags
  for (const tag of tags) {
    events.push({
      contact_id: contactId,
      timestamp: tag.added_at,
      category: 'TAG',
      event: 'Tag Added',
      details: tag.tag_name,
      source: 'ActiveCampaign',
      source_id: `tag-${tag.id}`,
      synced_at: now,
    });
  }

  // Tag history from logs (removals + adds not in current tags)
  const currentTagNames = new Set(tags.map(t => (t.tag_name || '').toLowerCase()));
  for (const log of contactLogs) {
    const logText = log.log || '';
    const logType = log.type || '';
    if (!logType.includes('tag') && !logText.toLowerCase().includes('tag')) continue;

    const addMatch = logText.match(/tag[:\s]+"?([^"]+)"?\s*(added|applied)/i) ||
                     logText.match(/(added|applied)\s+tag[:\s]+"?([^"]+)"?/i);
    const removeMatch = logText.match(/tag[:\s]+"?([^"]+)"?\s*(removed|deleted)/i) ||
                        logText.match(/(removed|deleted)\s+tag[:\s]+"?([^"]+)"?/i);

    if (removeMatch) {
      const tagName = removeMatch[1] || removeMatch[2];
      events.push({
        contact_id: contactId,
        timestamp: log.cdate,
        category: 'TAG',
        event: 'Tag Removed',
        details: tagName,
        source: 'ActiveCampaign',
        source_id: `tag-log-${log.id || log.cdate}`,
        synced_at: now,
      });
    } else if (addMatch) {
      const tagName = addMatch[1] || addMatch[2];
      if (!currentTagNames.has(tagName.toLowerCase())) {
        events.push({
          contact_id: contactId,
          timestamp: log.cdate,
          category: 'TAG',
          event: 'Tag Added',
          details: tagName,
          source: 'ActiveCampaign',
          source_id: `tag-log-${log.id || log.cdate}`,
          synced_at: now,
        });
      }
    }
  }

  // Automations
  for (const auto of automations) {
    events.push({
      contact_id: contactId,
      timestamp: auto.entered_at,
      category: 'AUTOMATION',
      event: 'Automation Started',
      details: `${auto.automation_name} (${auto.status})`,
      source: 'ActiveCampaign',
      source_id: `auto-start-${auto.id}`,
      synced_at: now,
    });
    if (auto.completed_at) {
      events.push({
        contact_id: contactId,
        timestamp: auto.completed_at,
        category: 'AUTOMATION',
        event: 'Automation Completed',
        details: auto.automation_name,
        source: 'ActiveCampaign',
        source_id: `auto-complete-${auto.id}`,
        synced_at: now,
      });
    }
  }

  // Email activities
  for (const act of emailActivities) {
    const eventName = act.activity_type === 'email_open' ? 'Email Opened' : 'Email Clicked';
    const details = [act.campaign_name, act.link_url ? `Link: ${act.link_url}` : null].filter(Boolean).join(' | ');
    events.push({
      contact_id: contactId,
      timestamp: act.timestamp,
      category: 'EMAIL',
      event: eventName,
      details: details || '',
      source: 'ActiveCampaign',
      source_id: `email-${act.activity_type}-${act.timestamp}-${contactId}`,
      synced_at: now,
    });
  }

  // Deals
  for (const deal of deals) {
    events.push({
      contact_id: contactId,
      timestamp: deal.created_at,
      category: 'DEAL',
      event: 'Deal Created',
      details: `${deal.title} - ${deal.pipeline} → ${deal.stage}`,
      source: 'ActiveCampaign',
      source_id: `deal-${deal.id}`,
      synced_at: now,
    });
  }

  // Contact notes (excluding JustCall notes)
  for (const note of notes) {
    if (isJustCallNote(note.content)) continue;
    events.push({
      contact_id: contactId,
      timestamp: note.created_at,
      category: 'NOTE',
      event: 'Contact Note Added',
      details: (note.content || '').substring(0, 100) + ((note.content || '').length > 100 ? '...' : ''),
      source: 'ActiveCampaign',
      source_id: `note-${note.id}`,
      synced_at: now,
    });
  }

  // Deal notes (excluding JustCall notes)
  for (const note of dealNotes) {
    if (isJustCallNote(note.content)) continue;
    events.push({
      contact_id: contactId,
      timestamp: note.created_at,
      category: 'NOTE',
      event: 'Deal Note Added',
      details: (note.content || '').substring(0, 100) + ((note.content || '').length > 100 ? '...' : ''),
      source: 'ActiveCampaign',
      source_id: `note-${note.id}`,
      synced_at: now,
    });
  }

  // SMS from notes
  for (const sms of smsFromNotes) {
    const category = sms.type === 'SMS_INBOUND' ? 'SMS_INBOUND' : 'SMS_OUTBOUND';
    const eventName = sms.type === 'SMS_INBOUND' ? 'SMS Received' : 'SMS Sent';
    events.push({
      contact_id: contactId,
      timestamp: sms.timestamp,
      category,
      event: eventName,
      details: (sms.message || '').substring(0, 100) + ((sms.message || '').length > 100 ? '...' : ''),
      source: 'JustCall Notes',
      source_id: sms.sms_id ? `sms-${sms.sms_id}` : `sms-note-${sms.note_id}`,
      synced_at: now,
    });
  }

  // Calls from notes
  for (const call of callsFromNotes) {
    let eventName = 'Call';
    if (call.type === 'CALL_INBOUND') eventName = 'Incoming Call';
    else if (call.type === 'CALL_OUTBOUND') eventName = 'Outgoing Call';
    else if (call.type === 'CALL_MISSED') eventName = 'Missed Call';
    else if (call.type === 'VOICEMAIL') eventName = 'Voicemail Left';

    let details = '';
    if (call.type === 'CALL_MISSED') details = call.from_phone ? `From: ${call.from_phone}` : 'No answer';
    else if (call.type === 'VOICEMAIL') details = call.recording ? 'Recording available' : 'No recording';
    else details = call.duration ? `Duration: ${call.duration}` : 'Connected';

    events.push({
      contact_id: contactId,
      timestamp: call.timestamp,
      category: call.type,
      event: eventName,
      details,
      source: 'JustCall Notes',
      source_id: call.call_id ? `call-${call.call_id}` : `call-note-${call.note_id}`,
      synced_at: now,
    });
  }

  return events;
}

// ============================================================================
// SYNC ONE CONTACT (all data types)
// ============================================================================

async function syncOneContact(contact) {
  const contactId = String(contact.id);

  // Fetch all AC data in parallel (notes, tags, automations, deals, activities, logs, field values)
  const [contactNotes, tags, automations, deals, emailActivities, contactLogs, fieldValuesRes] = await Promise.all([
    fetchContactNotes(contactId),
    fetchContactTags(contactId),
    fetchContactAutomations(contactId),
    fetchContactDeals(contactId),
    fetchContactEmailActivities(contactId),
    fetchContactLogs(contactId),
    fetchAC(`/contacts/${contactId}/fieldValues`).catch(() => ({ fieldValues: [] })),
  ]);
  // Use explicitly fetched field values (list endpoint often returns empty fieldValues)
  const fieldValues = fieldValuesRes.fieldValues || contact.fieldValues || [];

  // Fetch deal notes sequentially (one per deal)
  let allDealNotes = [];
  for (const deal of deals) {
    const dn = await fetchDealNotes(deal.id, contactId);
    allDealNotes.push(...dn);
    await sleep(50);
  }

  // Parse SMS and calls from all notes
  const allNotes = [...contactNotes, ...allDealNotes];
  const smsFromContactNotes = parseSmsFromNotes(contactNotes);
  const smsFromDealNotes = parseSmsFromNotes(allDealNotes);
  // Deduplicate
  const seenSmsIds = new Set();
  const seenMessages = new Set();
  const smsFromNotes = [];
  for (const sms of [...smsFromContactNotes, ...smsFromDealNotes]) {
    if (sms.sms_id && seenSmsIds.has(sms.sms_id)) continue;
    if (seenMessages.has(sms.message)) continue;
    if (sms.sms_id) seenSmsIds.add(sms.sms_id);
    seenMessages.add(sms.message);
    smsFromNotes.push(sms);
  }

  const callsFromContactNotes = parseCallsFromNotes(contactNotes);
  const callsFromDealNotes = parseCallsFromNotes(allDealNotes);
  const seenCallIds = new Set();
  const seenCallTs = new Set();
  const callsFromNotes = [];
  for (const call of [...callsFromContactNotes, ...callsFromDealNotes]) {
    if (call.call_id && seenCallIds.has(call.call_id)) continue;
    const tsKey = `${call.type}-${call.timestamp}`;
    if (seenCallTs.has(tsKey)) continue;
    if (call.call_id) seenCallIds.add(call.call_id);
    seenCallTs.add(tsKey);
    callsFromNotes.push(call);
  }

  // Build timeline events
  const timelineEvents = buildTimeline(contactId, {
    contact, tags, automations, deals,
    emailActivities, notes: contactNotes, dealNotes: allDealNotes,
    contactLogs, smsFromNotes, callsFromNotes,
  });

  // Upsert contact fields (using explicitly fetched field values)
  const parsed = parseContact(contact, fieldValues);
  await supabase.from('contacts').upsert(parsed, { onConflict: 'id' });

  // Upsert notes
  if (allNotes.length > 0) {
    await supabase.from('contact_notes').upsert(allNotes, { onConflict: 'id' });
  }

  // Upsert tags (delete old tags first, then insert current)
  await supabase.from('contact_tags').delete().eq('contact_id', contactId);
  if (tags.length > 0) {
    await supabase.from('contact_tags').upsert(tags, { onConflict: 'id' });
  }

  // Upsert automations
  if (automations.length > 0) {
    await supabase.from('contact_automations').upsert(automations, { onConflict: 'id' });
  }

  // Upsert deals
  if (deals.length > 0) {
    await supabase.from('contact_deals').upsert(deals, { onConflict: 'id' });
  }

  // Activities: delete old, insert fresh (no stable AC ID for these)
  await supabase.from('contact_activities').delete().eq('contact_id', contactId);
  if (emailActivities.length > 0) {
    // Insert in batches of 50 to avoid payload limits
    for (let i = 0; i < emailActivities.length; i += 50) {
      await supabase.from('contact_activities').insert(emailActivities.slice(i, i + 50));
    }
  }

  // Timeline: delete old, insert fresh
  await supabase.from('timeline_events').delete().eq('contact_id', contactId);
  if (timelineEvents.length > 0) {
    for (let i = 0; i < timelineEvents.length; i += 50) {
      await supabase.from('timeline_events').insert(timelineEvents.slice(i, i + 50));
    }
  }

  return {
    notes: allNotes.length,
    tags: tags.length,
    automations: automations.length,
    deals: deals.length,
    emailActivities: emailActivities.length,
    sms: smsFromNotes.length,
    calls: callsFromNotes.length,
    timeline: timelineEvents.length,
  };
}

// ============================================================================
// MAIN SYNC LOOP
// ============================================================================

async function run() {
  const startTime = Date.now();
  console.log('=== Full Expanded Sync ===');
  console.log(`Started: ${new Date().toISOString()}`);

  // Load cached lookups
  await loadCaches();

  // Log sync start
  const { data: syncRun } = await supabase
    .from('sync_log')
    .insert({ sync_type: 'full-expanded', status: 'running' })
    .select().single();

  let totalContacts = 0;
  let totalProcessed = 0;
  let errors = 0;
  const stats = { notes: 0, tags: 0, automations: 0, deals: 0, emailActivities: 0, sms: 0, calls: 0, timeline: 0 };

  if (SINGLE_CONTACT) {
    // Sync single contact
    console.log(`Syncing single contact: ${SINGLE_CONTACT}`);
    try {
      const data = await fetchAC(`/contacts/${SINGLE_CONTACT}`);
      const contact = data.contact;
      if (!contact) throw new Error('Contact not found');
      // Fetch field values separately
      const fvData = await fetchAC(`/contacts/${SINGLE_CONTACT}/fieldValues`);
      contact.fieldValues = fvData.fieldValues || [];
      const result = await syncOneContact(contact);
      totalProcessed = 1;
      Object.keys(stats).forEach(k => stats[k] += result[k]);
      console.log(`  Contact ${SINGLE_CONTACT}: ${JSON.stringify(result)}`);
    } catch (e) {
      console.error(`Error syncing contact ${SINGLE_CONTACT}: ${e.message}`);
      errors++;
    }
  } else {
    // Paginate through all contacts
    let offset = START_OFFSET;
    const pageSize = 100;

    // Build date filter if --days specified
    let dateFilter = '';
    if (DAYS) {
      const afterDate = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
      const afterStr = afterDate.toISOString();
      dateFilter = `&filters[created_after]=${encodeURIComponent(afterStr)}`;
      console.log(`Filtering contacts created after: ${afterStr.split('T')[0]} (last ${DAYS} days)`);
    }

    // Get total count first
    const firstPage = await fetchAC(`/contacts?limit=1&offset=0${dateFilter}`);
    totalContacts = parseInt(firstPage.meta?.total || 0);
    console.log(`AC total contacts: ${totalContacts}`);
    if (LIMIT_CONTACTS) console.log(`Limiting to ${LIMIT_CONTACTS} contacts`);
    if (START_OFFSET) console.log(`Starting from offset ${START_OFFSET}`);

    while (true) {
      if (LIMIT_CONTACTS && totalProcessed >= LIMIT_CONTACTS) break;

      const data = await fetchAC(`/contacts?limit=${pageSize}&offset=${offset}&orders[]=cdate${dateFilter}`);
      const contacts = data.contacts || [];
      if (contacts.length === 0) break;

      for (const contact of contacts) {
        if (LIMIT_CONTACTS && totalProcessed >= LIMIT_CONTACTS) break;

        try {
          const result = await syncOneContact(contact);
          totalProcessed++;
          Object.keys(stats).forEach(k => stats[k] += result[k]);

          if (totalProcessed % 10 === 0 || totalProcessed === 1) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const rate = (totalProcessed / (elapsed / 60)).toFixed(1);
            console.log(`  [${elapsed}s] ${totalProcessed}/${LIMIT_CONTACTS || totalContacts} contacts | ${rate}/min | ${requestCount} API calls | notes:${stats.notes} tags:${stats.tags} auto:${stats.automations} deals:${stats.deals} email:${stats.emailActivities} sms:${stats.sms} calls:${stats.calls} timeline:${stats.timeline}`);
          }
        } catch (e) {
          console.error(`  Error on contact ${contact.id} (${contact.email}): ${e.message}`);
          errors++;
        }

        // Pace between contacts to respect rate limits
        await sleep(200);
      }

      offset += contacts.length;
      if (contacts.length < pageSize) break;
      await sleep(250);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Get DB totals
  const { count: dbContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
  const { count: dbTimeline } = await supabase.from('timeline_events').select('*', { count: 'exact', head: true });

  // Update sync log
  await supabase.from('sync_log').update({
    completed_at: new Date().toISOString(),
    contacts_processed: totalProcessed,
    errors,
    db_total: dbContacts,
    status: errors > 0 ? 'partial' : 'success',
  }).eq('id', syncRun.id);

  console.log(`\n=== Sync Complete ===`);
  console.log(`Duration: ${elapsed}s`);
  console.log(`Contacts processed: ${totalProcessed}`);
  console.log(`API calls made: ${requestCount}`);
  console.log(`DB contacts: ${dbContacts}`);
  console.log(`DB timeline events: ${dbTimeline}`);
  console.log(`Stats: ${JSON.stringify(stats)}`);
  console.log(`Errors: ${errors}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
