-- Migration 005: Add new contact columns for expanded field map
-- Adds 25 new columns for fields discovered during AC field audit (2026-04-13)
-- Idempotent: uses IF NOT EXISTS

-- Lead Magnet
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS masterclass_cta TEXT;

-- Payment & Dates (new)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS date_purchased TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_product_purchased TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS y2_program_end_date TEXT;

-- Program Dates (corrected: program_start/program_end already exist, just adding new ones)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iso_start_date TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS program_end_date TEXT;

-- Embodiment Track
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS embodiment_amount_paid TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_call_date TEXT;

-- Status (new)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS progress TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_stage TEXT;

-- Booking Form
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS why_now TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS community_preference TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS investment_readiness TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS decision_maker TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS anything_else TEXT;

-- Quiz Responses
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type_of_drinker TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quiz_night_off TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quiz_head_sounds TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quiz_first_drink TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quiz_conversation TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quiz_cut_back TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quiz_where_are_you TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quiz_worries TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quiz_appealing TEXT;

-- Location
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country TEXT;
