-- Migration: Add tables for notes, tags, automations, deals, activities, and timeline events
-- Fully idempotent — safe to re-run

-- ============================================================================
-- Drop and recreate all new tables (clean slate for migration reruns)
-- Only drops tables we're creating — never touches 'contacts' or 'sync_log'
-- ============================================================================
DROP TABLE IF EXISTS timeline_events CASCADE;
DROP TABLE IF EXISTS contact_activities CASCADE;
DROP TABLE IF EXISTS contact_deals CASCADE;
DROP TABLE IF EXISTS contact_automations CASCADE;
DROP TABLE IF EXISTS contact_tags CASCADE;
DROP TABLE IF EXISTS contact_notes CASCADE;
DROP TABLE IF EXISTS tag_lookup CASCADE;
DROP TABLE IF EXISTS automation_lookup CASCADE;
DROP TABLE IF EXISTS deal_stage_lookup CASCADE;
DROP TABLE IF EXISTS deal_pipeline_lookup CASCADE;

-- ============================================================================
-- CONTACT NOTES
-- ============================================================================
CREATE TABLE contact_notes (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  rel_type TEXT NOT NULL DEFAULT 'Subscriber',
  rel_id TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contact_notes_contact ON contact_notes(contact_id);
CREATE INDEX idx_contact_notes_rel ON contact_notes(rel_type, rel_id);

-- ============================================================================
-- CONTACT TAGS
-- ============================================================================
CREATE TABLE contact_tags (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  tag_id TEXT NOT NULL,
  tag_name TEXT,
  added_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX idx_contact_tags_name ON contact_tags(tag_name);

-- ============================================================================
-- CONTACT AUTOMATIONS
-- ============================================================================
CREATE TABLE contact_automations (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  automation_id TEXT NOT NULL,
  automation_name TEXT,
  status TEXT,
  entered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contact_automations_contact ON contact_automations(contact_id);
CREATE INDEX idx_contact_automations_status ON contact_automations(status);

-- ============================================================================
-- CONTACT DEALS
-- ============================================================================
CREATE TABLE contact_deals (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  title TEXT,
  value_cents INTEGER,
  pipeline TEXT,
  stage TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contact_deals_contact ON contact_deals(contact_id);
CREATE INDEX idx_contact_deals_status ON contact_deals(status);

-- ============================================================================
-- CONTACT ACTIVITIES
-- ============================================================================
CREATE TABLE contact_activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  activity_type TEXT NOT NULL,
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
-- TIMELINE EVENTS
-- ============================================================================
CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  timestamp TIMESTAMPTZ NOT NULL,
  category TEXT NOT NULL,
  event TEXT NOT NULL,
  details TEXT,
  source TEXT,
  source_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_timeline_contact ON timeline_events(contact_id);
CREATE INDEX idx_timeline_ts ON timeline_events(timestamp);
CREATE INDEX idx_timeline_category ON timeline_events(category);
CREATE INDEX idx_timeline_source_id ON timeline_events(source_id);

-- ============================================================================
-- LOOKUP CACHES
-- ============================================================================
CREATE TABLE tag_lookup (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE automation_lookup (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deal_stage_lookup (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  group_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deal_pipeline_lookup (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
