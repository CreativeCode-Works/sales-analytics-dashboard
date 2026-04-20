#!/usr/bin/env node
/**
 * Incremental Expanded Sync — pulls only contacts updated since last sync,
 * then fetches all their relational data (notes, tags, automations, deals, etc.)
 *
 * Designed for cron: every 15 min - node ~/c/dashboard/v2/scripts/sync-incremental-full.js
 *
 * Much faster than sync-full.js since it only processes changed contacts.
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

// Re-use all the same field maps, parsers, and fetchers from sync-full.js
// We import the logic by requiring sync-full's shared pieces.
// For simplicity and to keep this self-contained, we duplicate the essentials.

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

// Caches
const tagCache = {};
const automationCache = {};
const stageCache = {};
const pipelineCache = {};

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
}

async function getTagName(tagId) {
  if (tagCache[tagId]) return tagCache[tagId];
  try {
    const data = await fetchAC(`/tags/${tagId}`);
    const name = data.tag?.tag || `Tag ${tagId}`;
    tagCache[tagId] = name;
    await supabase.from('tag_lookup').upsert({ id: String(tagId), name, synced_at: new Date().toISOString() }, { onConflict: 'id' });
    await sleep(50);
    return name;
  } catch (e) { return tagCache[tagId] = `Tag ${tagId}`; }
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
  } catch (e) { return automationCache[autoId] = `Automation ${autoId}`; }
}

async function getStageName(stageId) {
  if (stageCache[stageId]) return stageCache[stageId];
  try {
    const data = await fetchAC(`/dealStages/${stageId}`);
    const title = data.dealStage?.title || 'Unknown Stage';
    stageCache[stageId] = title;
    await supabase.from('deal_stage_lookup').upsert({ id: String(stageId), title, group_id: data.dealStage?.group || null, synced_at: new Date().toISOString() }, { onConflict: 'id' });
    await sleep(50);
    return title;
  } catch (e) { return stageCache[stageId] = 'Unknown Stage'; }
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
  } catch (e) { return pipelineCache[groupId] = 'Unknown Pipeline'; }
}

function parseContact(contact, fieldValues) {
  const fields = {};
  for (const fv of fieldValues) {
    const key = FIELD_MAP[parseInt(fv.field)];
    if (!key) continue;
    const val = fv.value;
    if (['quiz_taken', 'masterclass_taken'].includes(key)) fields[key] = val === 'Taken';
    else if (['smd_purchased', 'rise_purchased', 'bundle_purchased'].includes(key)) fields[key] = val && val.toLowerCase().includes('yes');
    else if (val && val.trim()) fields[key] = val;
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

// ============================================================================
// DATA FETCHERS (same as sync-full.js)
// ============================================================================

async function fetchContactNotes(contactId) {
  try {
    const data = await fetchAC(`/notes?filters[reltype]=Subscriber&filters[relid]=${contactId}&limit=100`);
    return (data.notes || []).map(n => ({
      id: String(n.id), contact_id: String(contactId), rel_type: 'Subscriber',
      rel_id: String(contactId), content: n.note, created_at: n.cdate,
      synced_at: new Date().toISOString(),
    }));
  } catch (e) { return []; }
}

async function fetchDealNotes(dealId, contactId) {
  try {
    const data = await fetchAC(`/notes?filters[reltype]=Deal&filters[relid]=${dealId}`);
    return (data.notes || []).map(n => ({
      id: String(n.id), contact_id: String(contactId), rel_type: 'Deal',
      rel_id: String(dealId), content: n.note, created_at: n.cdate,
      synced_at: new Date().toISOString(),
    }));
  } catch (e) { return []; }
}

async function fetchContactTags(contactId) {
  try {
    const data = await fetchAC(`/contacts/${contactId}/contactTags`);
    const results = [];
    for (const ct of (data.contactTags || [])) {
      const name = await getTagName(ct.tag);
      results.push({
        id: String(ct.id), contact_id: String(contactId), tag_id: String(ct.tag),
        tag_name: name, added_at: ct.cdate, synced_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (e) { return []; }
}

async function fetchContactAutomations(contactId) {
  try {
    const data = await fetchAC(`/contacts/${contactId}/contactAutomations`);
    const results = [];
    for (const a of (data.contactAutomations || [])) {
      const name = await getAutomationName(a.automation);
      results.push({
        id: String(a.id), contact_id: String(contactId), automation_id: String(a.automation),
        automation_name: name,
        status: a.status === '1' ? 'Active' : a.status === '2' ? 'Completed' : 'Stopped',
        entered_at: a.adddate, completed_at: a.completedate || null,
        synced_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (e) { return []; }
}

async function fetchContactDeals(contactId) {
  try {
    const data = await fetchAC(`/deals?filters[contact]=${contactId}`);
    const results = [];
    for (const d of (data.deals || [])) {
      const stage = d.stage ? await getStageName(d.stage) : 'Unknown Stage';
      const pipeline = d.group ? await getPipelineName(d.group) : 'Unknown Pipeline';
      results.push({
        id: String(d.id), contact_id: String(contactId), title: d.title,
        value_cents: d.value ? parseInt(d.value) : null, pipeline, stage,
        status: d.status === '0' ? 'Open' : d.status === '1' ? 'Won' : 'Lost',
        created_at: d.cdate, modified_at: d.mdate, synced_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (e) { return []; }
}

async function fetchContactEmailActivities(contactId) {
  try {
    const data = await fetchAC(`/activities?filters[contact]=${contactId}&limit=100`);
    const emailActs = (data.activities || []).filter(a =>
      a.referenceModelName === 'link-data' || a.referenceModelName === 'mpp-link-data'
    );
    const results = [];
    for (const act of emailActs) {
      const isOpen = act.referenceModelName === 'mpp-link-data' || act.reference?.link === 'open';
      let campaignName = null, linkUrl = null, campaignId = null;
      if (act.reference?.id) {
        try {
          const linkData = await fetchAC(`/links/${act.reference.id}`);
          linkUrl = linkData.link?.link || null;
          campaignId = linkData.link?.campaignid || null;
          if (campaignId) {
            try { const c = await fetchAC(`/campaigns/${campaignId}`); campaignName = c.campaign?.name || null; } catch (e) {}
          }
          await sleep(30);
        } catch (e) {}
      }
      results.push({
        contact_id: String(contactId), activity_type: isOpen ? 'email_open' : 'email_click',
        timestamp: act.tstamp, campaign_id: campaignId ? String(campaignId) : null,
        campaign_name: campaignName, link_url: linkUrl, details: null,
        synced_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (e) { return []; }
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
  } catch (e) { return []; }
}

// ============================================================================
// NOTE PARSING (same as sync-full.js)
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
      if (dateMatch) { const p = parseSmsDateTime(dateMatch[1].trim()); if (p) timestamp = p.toISOString(); }
      const fromMatch = content.match(/Received from:\s*(\+?\d+)/i);
      const toMatch = content.match(/Received on:[^(]*\(\s*(\+?\d+)\s*\)/i);
      const messageMatch = content.match(/Message:\s*([\s\S]*?)$/i);
      messages.push({ type: 'SMS_INBOUND', sms_id: smsIdMatch?.[1] || null, timestamp, from_phone: fromMatch?.[1] || '', to_phone: toMatch?.[1] || '', message: messageMatch?.[1]?.trim() || '', note_id: note.id });
    } else {
      const messageMatch = content.match(/Outgoing SMS:?\s*([\s\S]*?)$/i);
      messages.push({ type: 'SMS_OUTBOUND', sms_id: null, timestamp: note.created_at, from_phone: '', to_phone: '', message: messageMatch?.[1]?.trim() || '', note_id: note.id });
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
    if (dateMatch) { const p = parseSmsDateTime(dateMatch[1].trim()); if (p) timestamp = p.toISOString(); }
    const fromMatch = content.match(/(?:From|Caller):\s*(\+?[\d\s-]+)/i);
    const toMatch = content.match(/(?:To|Called):\s*(\+?[\d\s-]+)/i);
    const receivedOnMatch = content.match(/Received on:[^(]*\(\s*(\+?\d+)\s*\)/i);
    const durationMatch = content.match(/Duration:\s*([^\n]+)/i);
    const recordingMatch = content.match(/Recording:\s*(https?:\/\/[^\s\n]+)/i);
    calls.push({ type: callType, call_id: callIdMatch?.[1] || null, timestamp, from_phone: fromMatch?.[1]?.trim() || '', to_phone: toMatch?.[1]?.trim() || (receivedOnMatch?.[1] || ''), duration: durationMatch?.[1]?.trim() || null, recording: recordingMatch?.[1] || null, note_id: note.id });
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
// TIMELINE BUILDER (same as sync-full.js)
// ============================================================================

function buildTimeline(contactId, { contact, tags, automations, deals, emailActivities, notes, dealNotes, contactLogs, smsFromNotes, callsFromNotes }) {
  const events = [];
  const now = new Date().toISOString();

  events.push({ contact_id: contactId, timestamp: contact.cdate || contact.created_at, category: 'CONTACT', event: 'Contact Created', details: 'Added to ActiveCampaign', source: 'ActiveCampaign', source_id: `contact-created-${contactId}`, synced_at: now });

  for (const tag of tags) {
    events.push({ contact_id: contactId, timestamp: tag.added_at, category: 'TAG', event: 'Tag Added', details: tag.tag_name, source: 'ActiveCampaign', source_id: `tag-${tag.id}`, synced_at: now });
  }

  const currentTagNames = new Set(tags.map(t => (t.tag_name || '').toLowerCase()));
  for (const log of contactLogs) {
    const logText = log.log || '';
    if (!log.type?.includes('tag') && !logText.toLowerCase().includes('tag')) continue;
    const addMatch = logText.match(/tag[:\s]+"?([^"]+)"?\s*(added|applied)/i) || logText.match(/(added|applied)\s+tag[:\s]+"?([^"]+)"?/i);
    const removeMatch = logText.match(/tag[:\s]+"?([^"]+)"?\s*(removed|deleted)/i) || logText.match(/(removed|deleted)\s+tag[:\s]+"?([^"]+)"?/i);
    if (removeMatch) {
      events.push({ contact_id: contactId, timestamp: log.cdate, category: 'TAG', event: 'Tag Removed', details: removeMatch[1] || removeMatch[2], source: 'ActiveCampaign', source_id: `tag-log-${log.id || log.cdate}`, synced_at: now });
    } else if (addMatch && !currentTagNames.has((addMatch[1] || addMatch[2]).toLowerCase())) {
      events.push({ contact_id: contactId, timestamp: log.cdate, category: 'TAG', event: 'Tag Added', details: addMatch[1] || addMatch[2], source: 'ActiveCampaign', source_id: `tag-log-${log.id || log.cdate}`, synced_at: now });
    }
  }

  for (const auto of automations) {
    events.push({ contact_id: contactId, timestamp: auto.entered_at, category: 'AUTOMATION', event: 'Automation Started', details: `${auto.automation_name} (${auto.status})`, source: 'ActiveCampaign', source_id: `auto-start-${auto.id}`, synced_at: now });
    if (auto.completed_at) events.push({ contact_id: contactId, timestamp: auto.completed_at, category: 'AUTOMATION', event: 'Automation Completed', details: auto.automation_name, source: 'ActiveCampaign', source_id: `auto-complete-${auto.id}`, synced_at: now });
  }

  for (const act of emailActivities) {
    const eventName = act.activity_type === 'email_open' ? 'Email Opened' : 'Email Clicked';
    const details = [act.campaign_name, act.link_url ? `Link: ${act.link_url}` : null].filter(Boolean).join(' | ');
    events.push({ contact_id: contactId, timestamp: act.timestamp, category: 'EMAIL', event: eventName, details, source: 'ActiveCampaign', source_id: `email-${act.activity_type}-${act.timestamp}-${contactId}`, synced_at: now });
  }

  for (const deal of deals) {
    events.push({ contact_id: contactId, timestamp: deal.created_at, category: 'DEAL', event: 'Deal Created', details: `${deal.title} - ${deal.pipeline} → ${deal.stage}`, source: 'ActiveCampaign', source_id: `deal-${deal.id}`, synced_at: now });
  }

  for (const note of notes) {
    if (isJustCallNote(note.content)) continue;
    events.push({ contact_id: contactId, timestamp: note.created_at, category: 'NOTE', event: 'Contact Note Added', details: (note.content || '').substring(0, 100), source: 'ActiveCampaign', source_id: `note-${note.id}`, synced_at: now });
  }

  for (const note of dealNotes) {
    if (isJustCallNote(note.content)) continue;
    events.push({ contact_id: contactId, timestamp: note.created_at, category: 'NOTE', event: 'Deal Note Added', details: (note.content || '').substring(0, 100), source: 'ActiveCampaign', source_id: `note-${note.id}`, synced_at: now });
  }

  for (const sms of smsFromNotes) {
    events.push({ contact_id: contactId, timestamp: sms.timestamp, category: sms.type, event: sms.type === 'SMS_INBOUND' ? 'SMS Received' : 'SMS Sent', details: (sms.message || '').substring(0, 100), source: 'JustCall Notes', source_id: sms.sms_id ? `sms-${sms.sms_id}` : `sms-note-${sms.note_id}`, synced_at: now });
  }

  for (const call of callsFromNotes) {
    let eventName = 'Call', details = '';
    if (call.type === 'CALL_INBOUND') { eventName = 'Incoming Call'; details = call.duration ? `Duration: ${call.duration}` : 'Answered'; }
    else if (call.type === 'CALL_OUTBOUND') { eventName = 'Outgoing Call'; details = call.duration ? `Duration: ${call.duration}` : 'Connected'; }
    else if (call.type === 'CALL_MISSED') { eventName = 'Missed Call'; details = call.from_phone ? `From: ${call.from_phone}` : 'No answer'; }
    else if (call.type === 'VOICEMAIL') { eventName = 'Voicemail Left'; details = call.recording ? 'Recording available' : 'No recording'; }
    events.push({ contact_id: contactId, timestamp: call.timestamp, category: call.type, event: eventName, details, source: 'JustCall Notes', source_id: call.call_id ? `call-${call.call_id}` : `call-note-${call.note_id}`, synced_at: now });
  }

  return events;
}

// ============================================================================
// SYNC ONE CONTACT
// ============================================================================

async function syncOneContact(contact) {
  const contactId = String(contact.id);

  const [contactNotes, tags, automations, deals, emailActivities, contactLogs, fieldValuesRes] = await Promise.all([
    fetchContactNotes(contactId),
    fetchContactTags(contactId),
    fetchContactAutomations(contactId),
    fetchContactDeals(contactId),
    fetchContactEmailActivities(contactId),
    fetchContactLogs(contactId),
    fetchAC(`/contacts/${contactId}/fieldValues`).catch(() => ({ fieldValues: [] })),
  ]);
  const fieldValues = fieldValuesRes.fieldValues || contact.fieldValues || [];

  let allDealNotes = [];
  for (const deal of deals) {
    const dn = await fetchDealNotes(deal.id, contactId);
    allDealNotes.push(...dn);
    await sleep(50);
  }

  const allNotes = [...contactNotes, ...allDealNotes];

  // Parse and dedupe SMS
  const seenSmsIds = new Set(), seenMessages = new Set(), smsFromNotes = [];
  for (const sms of [...parseSmsFromNotes(contactNotes), ...parseSmsFromNotes(allDealNotes)]) {
    if (sms.sms_id && seenSmsIds.has(sms.sms_id)) continue;
    if (seenMessages.has(sms.message)) continue;
    if (sms.sms_id) seenSmsIds.add(sms.sms_id);
    seenMessages.add(sms.message);
    smsFromNotes.push(sms);
  }

  // Parse and dedupe calls
  const seenCallIds = new Set(), seenCallTs = new Set(), callsFromNotes = [];
  for (const call of [...parseCallsFromNotes(contactNotes), ...parseCallsFromNotes(allDealNotes)]) {
    if (call.call_id && seenCallIds.has(call.call_id)) continue;
    const tsKey = `${call.type}-${call.timestamp}`;
    if (seenCallTs.has(tsKey)) continue;
    if (call.call_id) seenCallIds.add(call.call_id);
    seenCallTs.add(tsKey);
    callsFromNotes.push(call);
  }

  const timelineEvents = buildTimeline(contactId, {
    contact, tags, automations, deals, emailActivities,
    notes: contactNotes, dealNotes: allDealNotes, contactLogs,
    smsFromNotes, callsFromNotes,
  });

  // Upsert all data
  const parsed = parseContact(contact, fieldValues);

  // Also derive booleans from tags (AC automation doesn't always set the field)
  const tagNames = tags.map(t => (t.tag_name || '').toLowerCase());
  if (!parsed.masterclass_taken && tagNames.some(t => t.includes('masterclass'))) {
    parsed.masterclass_taken = true;
  }
  if (!parsed.quiz_taken && tagNames.some(t => t === 'takeitorleaveit-quiz')) {
    parsed.quiz_taken = true;
  }

  await supabase.from('contacts').upsert(parsed, { onConflict: 'id' });
  if (allNotes.length > 0) await supabase.from('contact_notes').upsert(allNotes, { onConflict: 'id' });
  await supabase.from('contact_tags').delete().eq('contact_id', contactId);
  if (tags.length > 0) await supabase.from('contact_tags').upsert(tags, { onConflict: 'id' });
  if (automations.length > 0) await supabase.from('contact_automations').upsert(automations, { onConflict: 'id' });
  if (deals.length > 0) await supabase.from('contact_deals').upsert(deals, { onConflict: 'id' });
  await supabase.from('contact_activities').delete().eq('contact_id', contactId);
  if (emailActivities.length > 0) {
    for (let i = 0; i < emailActivities.length; i += 50) await supabase.from('contact_activities').insert(emailActivities.slice(i, i + 50));
  }
  await supabase.from('timeline_events').delete().eq('contact_id', contactId);
  if (timelineEvents.length > 0) {
    for (let i = 0; i < timelineEvents.length; i += 50) await supabase.from('timeline_events').insert(timelineEvents.slice(i, i + 50));
  }

  return { notes: allNotes.length, tags: tags.length, automations: automations.length, deals: deals.length, emailActivities: emailActivities.length, sms: smsFromNotes.length, calls: callsFromNotes.length, timeline: timelineEvents.length };
}

// ============================================================================
// MAIN
// ============================================================================

async function getLastSyncTime() {
  const { data } = await supabase
    .from('sync_log')
    .select('completed_at')
    .in('sync_type', ['full-expanded', 'incremental-expanded'])
    .eq('status', 'success')
    .order('id', { ascending: false })
    .limit(1);

  if (data?.[0]?.completed_at) return new Date(data[0].completed_at);
  // Fallback: 1 hour ago
  return new Date(Date.now() - 60 * 60 * 1000);
}

async function run() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting incremental expanded sync...`);

  await loadCaches();

  const lastSync = await getLastSyncTime();
  const updatedAfter = lastSync.toISOString().replace('T', ' ').split('.')[0];
  console.log(`Fetching contacts updated after: ${updatedAfter}`);

  const { data: syncRun } = await supabase
    .from('sync_log')
    .insert({ sync_type: 'incremental-expanded', status: 'running' })
    .select().single();

  let offset = 0;
  let totalProcessed = 0;
  let errors = 0;
  const stats = { notes: 0, tags: 0, automations: 0, deals: 0, emailActivities: 0, sms: 0, calls: 0, timeline: 0 };

  while (true) {
    try {
      const data = await fetchAC(`/contacts?limit=100&offset=${offset}&filters[updated_after]=${encodeURIComponent(updatedAfter)}`);
      const contacts = data.contacts || [];
      if (contacts.length === 0) break;

      for (const contact of contacts) {
        try {
          const result = await syncOneContact(contact);
          totalProcessed++;
          Object.keys(stats).forEach(k => stats[k] += result[k]);
          if (totalProcessed % 5 === 0) {
            console.log(`  Processed ${totalProcessed} contacts... (${requestCount} API calls)`);
          }
        } catch (e) {
          console.error(`  Error on contact ${contact.id}: ${e.message}`);
          errors++;
        }
        await sleep(200);
      }

      offset += contacts.length;
      if (contacts.length < 100) break;
      await sleep(250);
    } catch (e) {
      console.error('Fetch error:', e.message);
      errors++;
      break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const { count: dbContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true });

  await supabase.from('sync_log').update({
    completed_at: new Date().toISOString(),
    contacts_processed: totalProcessed,
    contacts_updated: totalProcessed,
    errors,
    db_total: dbContacts,
    status: errors > 0 ? 'partial' : 'success',
  }).eq('id', syncRun.id);

  console.log(`\nIncremental expanded sync complete:`);
  console.log(`  Duration: ${elapsed}s`);
  console.log(`  Contacts updated: ${totalProcessed}`);
  console.log(`  API calls: ${requestCount}`);
  console.log(`  Stats: ${JSON.stringify(stats)}`);
  console.log(`  Errors: ${errors}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
