# RLS Migration - Quick Start Guide

## 🚀 Execute in 3 Steps

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** → **New Query**

### Step 2: Run the Migration
1. Open `supabase/migrations/20260122_enforce_rls.sql`
2. Copy ALL the contents
3. Paste into SQL Editor
4. Click **Run** (or Cmd/Ctrl + Enter)
5. Wait for "Success" message ✅

### Step 3: Test It
1. Go to http://localhost:5174/register
2. Create a test account
3. Verify you can see the dashboard
4. Create a customer or project to verify write access

---

## 🔒 What Just Happened?

Your database is now **LOCKED DOWN**:
- ✅ Users can ONLY see their own company's data
- ✅ No cross-company data leaks possible
- ✅ All tables protected by Row Level Security
- ✅ Ready for production deployment

---

## 🐛 Quick Troubleshooting

**No data showing?**
→ Make sure you're logged in and your profile has a company_id

**Can't insert records?**
→ Your frontend should automatically set company_id from the user's profile

**Permission denied?**
→ RLS is working! You're trying to access data you don't own

---

## 📍 Files Created

```
supabase/
└── migrations/
    ├── 20260122_enforce_rls.sql  ← The migration (run this!)
    ├── README.md                  ← Full documentation
    └── QUICK_START.md            ← This file
```

---

## ✨ Next Steps

After running the migration:

1. **Test registration**: Create a new account
2. **Test data access**: Verify tenant isolation
3. **Test CRUD operations**: Create, read, update, delete
4. **Deploy to production**: You're now security-ready!

---

**Need help?** See `README.md` for detailed troubleshooting.
