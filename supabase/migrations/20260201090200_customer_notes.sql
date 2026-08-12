-- Migration: Add notes field to customers table
-- Phase 2.2: Customer notes field

-- Add notes column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes text;

-- Comment
COMMENT ON COLUMN customers.notes IS 'Internal notes about the customer';
