-- Migration: Dashboard actions queue for AC writeback
-- Run in Supabase SQL Editor

DROP TABLE IF EXISTS dashboard_actions CASCADE;

CREATE TABLE dashboard_actions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contact_id TEXT NOT NULL,
  action_type TEXT NOT NULL,        -- 'move_deal', 'add_note', 'update_field'
  payload JSONB NOT NULL,           -- {deal_id, new_stage_id, new_group_id} or {note_text} etc.
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'synced', 'failed'
  error_message TEXT,
  created_by TEXT DEFAULT 'dashboard',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX idx_actions_status ON dashboard_actions(status);
CREATE INDEX idx_actions_contact ON dashboard_actions(contact_id);
CREATE INDEX idx_actions_created ON dashboard_actions(created_at);
