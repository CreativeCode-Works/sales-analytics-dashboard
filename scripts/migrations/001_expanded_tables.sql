-- Migration: Add tables for notes, tags, automations, deals, activities, and timeline events
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================================================
-- CONTACT NOTES (raw notes from AC — source for JustCall SMS/call parsing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_notes (
  id TEXT PRIMARY KEY,                    -- AC note ID
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  rel_type TEXT NOT NULL DEFAULT 'Subscriber',  -- 'Subscriber' or 'Deal'
  rel_id TEXT,                            -- deal_id if rel_type='Deal'
  content TEXT,
  created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_notes_contact ON contact_notes(contact_id);
CREATE INDEX idx_contact_notes_rel ON contact_notes(rel_type, rel_id);

-- ============================================================================
-- CONTACT TAGS (current tags with add dates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_tags (
  id TEXT PRIMARY KEY,                    -- AC contactTag ID
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  tag_id TEXT NOT NULL,
  tag_name TEXT,
  added_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX idx_contact_tags_name ON contact_tags(tag_name);

-- ============================================================================
-- CONTACT AUTOMATIONS (automation enrollments with status)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_automations (
  id TEXT PRIMARY KEY,                    -- AC contactAutomation ID
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  automation_id TEXT NOT NULL,
  automation_name TEXT,
  status TEXT,                            -- 'Active', 'Completed', 'Stopped'
  entered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_automations_contact ON contact_automations(contact_id);
CREATE INDEX idx_contact_automations_status ON contact_automations(status);

-- ============================================================================
-- CONTACT DEALS (deals with pipeline, stage, value)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_deals (
  id TEXT PRIMARY KEY,                    -- AC deal ID
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  title TEXT,
  value_cents INTEGER,                    -- deal value in cents
  pipeline TEXT,
  stage TEXT,
  status TEXT,                            -- 'Open', 'Won', 'Lost'
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_deals_contact ON contact_deals(contact_id);
CREATE INDEX idx_contact_deals_status ON contact_deals(status);

-- ============================================================================
-- CONTACT ACTIVITIES (email opens, clicks, and other activities)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  activity_type TEXT NOT NULL,            -- 'email_open', 'email_click', 'email_bounce', 'unsubscribe'
  timestamp TIMESTAMPTZ,
  campaign_id TEXT,
  campaign_name TEXT,
  link_url TEXT,
  details TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_activities_contact ON contact_activities(contact_id);
CREATE INDEX idx_contact_activities_type ON contact_activities(activity_type);
CREATE INDEX idx_contact_activities_ts ON contact_activities(timestamp);

-- ============================================================================
-- TIMELINE EVENTS (unified, pre-built timeline — computed server-side during sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  timestamp TIMESTAMPTZ NOT NULL,
  category TEXT NOT NULL,                 -- CONTACT, TAG, AUTOMATION, EMAIL, DEAL, NOTE, SMS_INBOUND, SMS_OUTBOUND, CALL_INBOUND, CALL_OUTBOUND, CALL_MISSED, VOICEMAIL, BOOKING, STATE, ACTIVITY
  event TEXT NOT NULL,                    -- 'Tag Added', 'Email Opened', 'SMS Received', etc.
  details TEXT,
  source TEXT,                            -- 'ActiveCampaign', 'JustCall Notes', etc.
  source_id TEXT,                         -- original record ID for deduplication
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_contact ON timeline_events(contact_id);
CREATE INDEX idx_timeline_ts ON timeline_events(timestamp);
CREATE INDEX idx_timeline_category ON timeline_events(category);
CREATE INDEX idx_timeline_source_id ON timeline_events(source_id);
-- Unique constraint to prevent duplicate timeline entries on re-sync
CREATE UNIQUE INDEX idx_timeline_dedup ON timeline_events(contact_id, category, source_id) WHERE source_id IS NOT NULL;

-- ============================================================================
-- TAG LOOKUP (cache tag ID → name so we don't re-fetch)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tag_lookup (
  id TEXT PRIMARY KEY,                    -- AC tag ID
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUTOMATION LOOKUP (cache automation ID → name)
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_lookup (
  id TEXT PRIMARY KEY,                    -- AC automation ID
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DEAL STAGE / PIPELINE LOOKUP
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_stage_lookup (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  group_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_pipeline_lookup (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
