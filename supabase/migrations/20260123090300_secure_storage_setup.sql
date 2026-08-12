-- =====================================================================
-- STORAGE SECURITY SETUP: Multi-Tenant File Upload Protection
-- =====================================================================
-- Migration: 20260123_secure_storage_setup.sql
-- Purpose: Set up RLS policies for secure 'invoices' bucket
-- Date: 2026-01-23
--
-- CRITICAL: This migration ensures that users can ONLY upload and access
-- files belonging to their own company. File paths MUST follow the format:
-- {company_id}/{filename}
--
-- PREREQUISITE: You MUST manually create the 'invoices' bucket first:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: "invoices"
-- 4. Public: OFF (unchecked)
-- 5. File size limit: 10 MB
-- 6. Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENABLE RLS ON STORAGE.OBJECTS (if not already enabled)
-- ---------------------------------------------------------------------
-- Force enable Row Level Security on the objects table to ensure
-- all file access goes through our security policies
-- ---------------------------------------------------------------------

DO $$
BEGIN
  -- Enable RLS on storage.objects if storage schema exists
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Storage schema not found. Please enable Storage in Supabase Dashboard first.';
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 2. DROP EXISTING POLICIES (Clean Slate)
-- ---------------------------------------------------------------------
-- Remove any existing policies on storage.objects to avoid conflicts
-- and ensure we have a consistent security model
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    DROP POLICY IF EXISTS "Tenant isolation for invoices - SELECT" ON storage.objects;
    DROP POLICY IF EXISTS "Tenant isolation for invoices - INSERT" ON storage.objects;
    DROP POLICY IF EXISTS "Tenant isolation for invoices - UPDATE" ON storage.objects;
    DROP POLICY IF EXISTS "Tenant isolation for invoices - DELETE" ON storage.objects;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 3. CREATE RLS POLICIES FOR INVOICES BUCKET
-- ---------------------------------------------------------------------
-- These policies enforce that:
-- 1. File paths MUST start with {company_id}/
-- 2. Users can ONLY access files in their company's folder
-- 3. The company_id is validated against the authenticated user's profile
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    -- SELECT Policy: Users can view files in their company folder
    EXECUTE 'CREATE POLICY "Tenant isolation for invoices - SELECT"
      ON storage.objects
      FOR SELECT
      USING (
        bucket_id = ''invoices'' AND
        (storage.foldername(name))[1] = get_user_company_id()::text
      )';

    -- INSERT Policy: Users can upload files to their company folder
    EXECUTE 'CREATE POLICY "Tenant isolation for invoices - INSERT"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = ''invoices'' AND
        (storage.foldername(name))[1] = get_user_company_id()::text
      )';

    -- UPDATE Policy: Users can update metadata of files in their company folder
    EXECUTE 'CREATE POLICY "Tenant isolation for invoices - UPDATE"
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = ''invoices'' AND
        (storage.foldername(name))[1] = get_user_company_id()::text
      )
      WITH CHECK (
        bucket_id = ''invoices'' AND
        (storage.foldername(name))[1] = get_user_company_id()::text
      )';

    -- DELETE Policy: Users can delete files from their company folder
    EXECUTE 'CREATE POLICY "Tenant isolation for invoices - DELETE"
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = ''invoices'' AND
        (storage.foldername(name))[1] = get_user_company_id()::text
      )';

    RAISE NOTICE 'Storage RLS policies created successfully for invoices bucket.';
  ELSE
    RAISE NOTICE 'Storage schema not found. Please enable Storage in Supabase Dashboard first.';
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 4. GRANT PERMISSIONS (if needed)
-- ---------------------------------------------------------------------
-- Supabase automatically grants necessary permissions for storage
-- operations when using the Supabase client. No explicit GRANT needed.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 5. VERIFICATION QUERIES (OPTIONAL - FOR TESTING)
-- ---------------------------------------------------------------------
-- Uncomment these queries to verify storage security is working correctly
-- ---------------------------------------------------------------------

/*
-- Verify bucket exists (run in Supabase Dashboard after manual bucket creation)
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'invoices';

-- Verify RLS is enabled on storage.objects
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Verify all policies are created
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Test file upload (must be run as authenticated user)
-- Expected: Should only succeed if path starts with your company_id
-- Example: INSERT INTO storage.objects (bucket_id, name)
--          VALUES ('invoices', '<YOUR_COMPANY_ID>/test.pdf');
*/


-- =====================================================================
-- POST-MIGRATION INSTRUCTIONS
-- =====================================================================
--
-- STEP 1: MANUALLY CREATE THE BUCKET (REQUIRED!)
-- -------------------------------------------------------
-- This migration ONLY sets up RLS policies. You MUST create the bucket
-- manually in the Supabase Dashboard:
--
-- 1. Go to: Supabase Dashboard → Storage
-- 2. Click: "New bucket"
-- 3. Settings:
--    - Name: invoices
--    - Public: OFF (unchecked)
--    - File size limit: 10 MB
--    - Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp
-- 4. Click: "Create bucket"
--
-- STEP 2: RUN THIS MIGRATION
-- -------------------------------------------------------
-- After creating the bucket, run this migration to set up RLS policies.
--
-- STEP 3: VERIFY POLICIES
-- -------------------------------------------------------
-- Run these queries to verify everything is set up correctly:
--
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
-- ORDER BY policyname;
--
-- Expected: 4 policies for 'invoices' bucket (SELECT, INSERT, UPDATE, DELETE)
--
-- =====================================================================
-- FRONTEND IMPLEMENTATION
-- =====================================================================
--
-- CRITICAL: Frontend code MUST use the following file path format:
--
-- File Path Format: {company_id}/{filename}
--
-- Example Upload Code:
-- ```typescript
-- const { data: { user } } = await supabase.auth.getUser();
-- const { data: profile } = await supabase
--   .from('profiles')
--   .select('company_id')
--   .eq('id', user.id)
--   .single();
--
-- const filePath = `${profile.company_id}/${file.name}`;
--
-- const { data, error } = await supabase.storage
--   .from('invoices')
--   .upload(filePath, file);
-- ```
--
-- TESTING:
-- 1. Log in as a test user
-- 2. Attempt to upload a file to 'invoices' bucket
-- 3. Verify file path starts with your company_id
-- 4. Attempt to access another company's file (should fail with 403)
-- 5. Verify only files in your company folder are visible
--
-- SECURITY NOTES:
-- - File paths are immutable after upload
-- - Users cannot rename files to escape their company folder
-- - The storage.foldername() function extracts the first path segment
-- - get_user_company_id() ensures the company_id matches the auth user
--
-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
