-- Migration: Add Calendly events and JustCall logs tables
-- Run in Supabase SQL Editor

DROP TABLE IF EXISTS calendly_events CASCADE;
DROP TABLE IF EXISTS justcall_calls CASCADE;
DROP TABLE IF EXISTS justcall_texts CASCADE;

-- ============================================================================
-- CALENDLY EVENTS (bookings, cancellations, no-shows, reschedules)
-- ============================================================================
CREATE TABLE calendly_events (
  id TEXT PRIMARY KEY,                    -- Calendly event UUID
  contact_email TEXT,
  contact_name TEXT,
  event_type TEXT,                        -- e.g. "Discovery Call", "Follow Up"
  event_type_slug TEXT,
  status TEXT,                            -- 'active', 'canceled'
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  rescheduled BOOLEAN DEFAULT false,
  rescheduled_from TEXT,                  -- UUID of original event
  no_show BOOLEAN DEFAULT false,
  location TEXT,
  host_name TEXT,
  host_email TEXT,
  is_follow_up BOOLEAN DEFAULT false,    -- event labeled "Follow Up" with discovery host
  contact_id TEXT,                        -- matched to contacts.id by email
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_calendly_email ON calendly_events(contact_email);
CREATE INDEX idx_calendly_contact ON calendly_events(contact_id);
CREATE INDEX idx_calendly_start ON calendly_events(start_time);
CREATE INDEX idx_calendly_status ON calendly_events(status);

-- ============================================================================
-- JUSTCALL CALLS (for cross-referencing with AC notes)
-- ============================================================================
CREATE TABLE justcall_calls (
  id TEXT PRIMARY KEY,                    -- JustCall call ID
  contact_phone TEXT,
  contact_name TEXT,
  direction TEXT,                         -- 'inbound', 'outbound'
  status TEXT,                            -- 'answered', 'missed', 'voicemail', etc.
  duration INTEGER,                       -- seconds
  recording_url TEXT,
  agent_name TEXT,
  agent_number TEXT,
  contact_number TEXT,
  called_at TIMESTAMPTZ,
  contact_id TEXT,                        -- matched to contacts.id by phone
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jc_calls_phone ON justcall_calls(contact_phone);
CREATE INDEX idx_jc_calls_contact ON justcall_calls(contact_id);
CREATE INDEX idx_jc_calls_time ON justcall_calls(called_at);

-- ============================================================================
-- JUSTCALL TEXTS (for cross-referencing with AC notes)
-- ============================================================================
CREATE TABLE justcall_texts (
  id TEXT PRIMARY KEY,                    -- JustCall SMS ID
  contact_phone TEXT,
  direction TEXT,                         -- 'inbound', 'outbound'
  body TEXT,
  agent_name TEXT,
  agent_number TEXT,
  contact_number TEXT,
  sent_at TIMESTAMPTZ,
  contact_id TEXT,                        -- matched to contacts.id by phone
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jc_texts_phone ON justcall_texts(contact_phone);
CREATE INDEX idx_jc_texts_contact ON justcall_texts(contact_id);
CREATE INDEX idx_jc_texts_time ON justcall_texts(sent_at);
