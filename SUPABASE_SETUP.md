# Setting Up Your Own Supabase Database

Follow these steps to connect this expense tracker to your own Supabase account.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click "New Project"
3. Fill in the project details:
   - **Name**: Choose a name (e.g., "expense-tracker")
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest region to your users
4. Click "Create new project" and wait 1-2 minutes for setup

## Step 2: Get Your Credentials

1. In your Supabase project dashboard, click on the **Settings** icon (gear icon) in the sidebar
2. Navigate to **API** section
3. You'll find two important values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)
4. Keep these handy for the next step

## Step 3: Update Environment Variables

1. Open the `.env` file in your project root
2. Update it with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Save the file

## Step 4: Run Database Migrations

You need to apply the database schema to your Supabase project. You have two options:

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase dashboard
2. Click on **SQL Editor** in the sidebar
3. Click "New query"
4. Copy and paste the contents of each migration file in order:
   - Open `supabase/migrations/20260114125656_create_expenses_table.sql`
   - Copy the entire content and paste into SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Repeat for all migration files in chronological order:
     1. `20260114125656_create_expenses_table.sql`
     2. `20260114133308_fix_security_performance_issues.sql`
     3. `20260114134453_restore_anon_access_for_simple_expenses.sql`
     4. `20260114135858_add_enhanced_features_simple.sql`
     5. `20260114141657_add_comprehensive_feature_flags.sql`
     6. `20260114142429_remove_unused_indexes.sql`
     7. `20260114142454_fix_security_issues_drop_unused_indexes_and_refactor_rls.sql`
     8. `20260114142456_implement_session_based_isolation.sql`
     9. `20260114184817_fix_rls_policies_for_session_based_access.sql`
     10. `20260114191516_fix_user_id_requirement.sql`
     11. `20260114192901_setup_auth_rls_policies.sql`
     12. `20260114202923_fix_app_settings_rls.sql`
     13. `20260114213546_add_authenticated_access_to_app_tables.sql`
     14. `20260114214539_add_authenticated_access_to_filter_presets.sql`

### Option B: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

## Step 5: Verify Setup

1. In Supabase dashboard, go to **Table Editor**
2. You should see these tables:
   - `expenses`
   - `budgets`
   - `savings_goals`
   - `incomes`
   - `recurring_transactions`
   - `filter_presets`
   - `app_settings`

3. Go to **Authentication** > **Policies** to verify Row Level Security policies are in place

## Step 6: Test Your App

1. Start your development server:
```bash
npm run dev
```

2. The app should now connect to your Supabase database
3. Try creating an account, logging in, and adding expenses

## Step 7: Deploy to Netlify (Optional)

When deploying to Netlify, don't forget to add the environment variables:

1. In Netlify dashboard, go to **Site settings** > **Environment variables**
2. Add:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
3. Redeploy your site

## Troubleshooting

**"Failed to fetch" errors:**
- Check that your `.env` file has the correct credentials
- Restart your dev server after updating `.env`

**"Row Level Security policy violation":**
- Make sure all migrations were applied in order
- Check the RLS policies in Supabase dashboard

**Authentication not working:**
- Verify that Supabase Auth is enabled in your project
- Check that email/password authentication is enabled in Supabase dashboard under **Authentication** > **Providers**

**Need help?**
- Check [Supabase documentation](https://supabase.com/docs)
- Join [Supabase Discord](https://discord.supabase.com)

---

That's it! Your expense tracker is now connected to your own Supabase database.
