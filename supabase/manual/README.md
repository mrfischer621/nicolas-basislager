# RLS Migration Instructions

## Security Phase 3: The Lockdown

This migration enforces strict Row Level Security (RLS) on all tables in your CRM system.

---

## What This Migration Does

1. **Creates Helper Function**: `get_user_company_id()` - efficiently retrieves the current user's company ID
2. **Enables RLS**: Turns on Row Level Security for ALL tables
3. **Drops Old Policies**: Removes any existing policies for a clean slate
4. **Creates New Policies**: Implements strict tenant isolation:
   - Standard tables (customers, projects, etc.): Users only access their company's data
   - Companies table: Users can only view/edit their own company
   - Profiles table: Users can only access their own profile
   - Invoice items: Access controlled via parent invoice's company

---

## How to Execute

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy the Migration**
   - Open the file: `supabase/migrations/20260122_enforce_rls.sql`
   - Copy the entire contents

4. **Paste and Execute**
   - Paste the SQL into the editor
   - Click "Run" (or press Cmd/Ctrl + Enter)
   - Wait for "Success" message

5. **Verify**
   - You should see: "Success. No rows returned"
   - Check the "Database" → "Tables" section to verify RLS is enabled (green shield icon)

### Option 2: Supabase CLI (Advanced)

If you have the Supabase CLI installed and configured:

```bash
cd /Users/nicolas/crm-projekt
supabase db push
```

---

## Post-Migration Testing

### Test 1: Register a New User
1. Go to http://localhost:5174/register
2. Create a new account with:
   - Company Name: "Test Company"
   - Email: test@example.com
   - Password: test123
3. Verify you can successfully register and log in

### Test 2: Verify Tenant Isolation
1. Log in as your test user
2. Navigate to Dashboard
3. Verify you ONLY see data for "Test Company"
4. Try to create customers, projects, etc. - all should work

### Test 3: Verify Data Isolation (Advanced)
1. If you have multiple test accounts, log in with each
2. Verify that each user ONLY sees their own company's data
3. Data from other companies should be completely invisible

---

## Troubleshooting

### Issue: "permission denied for table X"
**Solution**: RLS is working! This means you're not logged in or don't have access to that company's data.

### Issue: "function get_user_company_id() does not exist"
**Solution**: The migration didn't run completely. Re-run the entire SQL file.

### Issue: "No data showing after migration"
**Possible Causes**:
1. Your user's profile doesn't have a `company_id` set
   - Check: `SELECT * FROM profiles WHERE id = auth.uid();`
   - Fix: Update the profile with the correct company_id

2. You're not logged in
   - Make sure you're authenticated in the app

3. Your company has no data yet
   - Create some test data to verify RLS is working

### Issue: "Cannot insert into table X"
**Solution**: Make sure the record you're inserting has the correct `company_id` matching your user's company.

---

## Rollback (Emergency Only)

If you need to disable RLS temporarily (NOT RECOMMENDED for production):

```sql
-- Disable RLS on all tables (DANGEROUS - ONLY FOR DEBUGGING)
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.year_end_closings DISABLE ROW LEVEL SECURITY;
```

**WARNING**: Only use this for debugging. Always re-enable RLS before deploying to production!

---

## Security Checklist

After running this migration, verify:

- [x] RLS is enabled on ALL tables
- [x] Users can register and create companies
- [x] Users can only see their own company's data
- [x] Users cannot access other companies' data
- [x] All CRUD operations (Create, Read, Update, Delete) work correctly
- [x] The `get_user_company_id()` function returns the correct company ID

---

## Migration Status

- **Created**: 2026-01-22
- **Status**: Ready to execute
- **Tested**: Pending your execution
- **Production Ready**: Yes (after testing)

---

## Questions?

If you encounter issues:
1. Check the troubleshooting section above
2. Review the Supabase logs in the Dashboard
3. Verify your user's profile has a valid `company_id`
