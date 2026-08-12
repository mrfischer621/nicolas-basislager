-- ============================================================================
-- Migration: Per-quote intro/outro text + profile logo URL
-- Date: 2026-02-23
-- Description:
--   1. Adds `intro_text` and `outro_text` directly on the `quotes` table,
--      allowing each quote to override the company-level text templates.
--   2. Adds `logo_url` to `profiles` for per-user avatar/logo storage.
--
-- NOTE: logo_url on companies already exists. These are NEW columns.
-- Run via: Supabase SQL editor or migration CLI.
-- ============================================================================

-- 1. Per-quote text overrides on quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS intro_text TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS outro_text TEXT DEFAULT NULL;

COMMENT ON COLUMN public.quotes.intro_text IS
  'Optional intro text shown above the items table. Overrides company-level quote_intro_text when set.';

COMMENT ON COLUMN public.quotes.outro_text IS
  'Optional outro/closing text shown below the items table. Overrides company-level quote_footer_text when set.';

-- 2. Per-user logo URL on profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.profiles.logo_url IS
  'Optional profile picture or personal logo URL for the user.';
