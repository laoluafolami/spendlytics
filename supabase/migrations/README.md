# Spendlytics Database Migrations

## Overview

This folder contains SQL migrations for the Spendlytics finance tracking tables.

## Migration: `20260122_create_finance_tables.sql`

Creates the following tables for the Balance Sheet / Net Worth tracking features:

| Table | Purpose |
|-------|---------|
| `assets` | Track user assets (cash, bank accounts, property, etc.) |
| `liabilities` | Track user debts (loans, credit cards, mortgages) |
| `investments` | Track investment portfolio with live price updates |
| `net_worth_snapshots` | Historical net worth for trend analysis |

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `20260122_create_finance_tables.sql`
5. Click **Run** (or press Ctrl+Enter)

### Option 2: Supabase CLI

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
supabase db push
```

### Option 3: Direct PostgreSQL Connection

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260122_create_finance_tables.sql
```

## Tables Schema

### `assets`

```sql
- id: UUID (primary key)
- user_id: UUID (references auth.users)
- name: VARCHAR(255)
- type: ENUM ('cash', 'bank_account', 'investment', 'stocks', 'bonds',
              'mutual_funds', 'real_estate', 'vehicle', 'retirement',
              'business', 'collectible', 'other')
- category: ENUM ('liquid', 'marketable', 'long_term', 'personal')
- value: DECIMAL(15, 2)
- currency: VARCHAR(3) default 'NGN'
- purchase_date: DATE (optional)
- purchase_price: DECIMAL(15, 2) (optional)
- notes: TEXT (optional)
- is_active: BOOLEAN default true
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### `liabilities`

```sql
- id: UUID (primary key)
- user_id: UUID (references auth.users)
- name: VARCHAR(255)
- type: ENUM ('credit_card', 'personal_loan', 'mortgage', 'car_loan',
              'student_loan', 'business_loan', 'family_loan', 'other')
- principal_amount: DECIMAL(15, 2)
- current_balance: DECIMAL(15, 2)
- currency: VARCHAR(3) default 'NGN'
- interest_rate: DECIMAL(5, 2) (optional, annual %)
- minimum_payment: DECIMAL(15, 2) (optional)
- due_date: INTEGER 1-31 (optional, day of month)
- notes: TEXT (optional)
- is_active: BOOLEAN default true
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### `investments`

```sql
- id: UUID (primary key)
- user_id: UUID (references auth.users)
- symbol: VARCHAR(20)
- name: VARCHAR(255)
- type: ENUM ('stock', 'etf', 'mutual_fund', 'bond', 'crypto',
              'reit', 'commodity', 'other')
- shares: DECIMAL(18, 8)
- average_cost: DECIMAL(15, 4)
- current_price: DECIMAL(15, 4)
- market_value: DECIMAL(15, 2) [GENERATED: shares * current_price]
- cost_basis: DECIMAL(15, 2) [GENERATED: shares * average_cost]
- gain_loss: DECIMAL(15, 2) [GENERATED: market_value - cost_basis]
- gain_loss_percent: DECIMAL(10, 4) [GENERATED]
- purchase_date: DATE (optional)
- dividend_yield: DECIMAL(5, 2) (optional)
- last_dividend: DECIMAL(15, 4) (optional)
- sector: VARCHAR(100) (optional)
- currency: VARCHAR(3) default 'NGN'
- notes: TEXT (optional)
- is_active: BOOLEAN default true
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### `net_worth_snapshots`

```sql
- id: UUID (primary key)
- user_id: UUID (references auth.users)
- date: DATE (unique per user)
- total_assets: DECIMAL(15, 2)
- total_liabilities: DECIMAL(15, 2)
- net_worth: DECIMAL(15, 2) [GENERATED: total_assets - total_liabilities]
- currency: VARCHAR(3) default 'NGN'
- created_at: TIMESTAMPTZ
```

## Helper Functions

The migration creates these PostgreSQL functions:

| Function | Description |
|----------|-------------|
| `get_total_assets(user_id)` | Returns sum of all active assets |
| `get_total_liabilities(user_id)` | Returns sum of all active liabilities |
| `get_total_investments(user_id)` | Returns total investment market value |
| `get_net_worth(user_id)` | Returns assets - liabilities |
| `create_net_worth_snapshot(user_id, currency)` | Creates/updates daily snapshot |

### Usage Example (from Supabase client)

```typescript
// Call the net worth function
const { data, error } = await supabase.rpc('get_net_worth', {
  p_user_id: userId
})

// Create a snapshot
const { data, error } = await supabase.rpc('create_net_worth_snapshot', {
  p_user_id: userId,
  p_currency: 'NGN'
})
```

## Row Level Security

All tables have RLS enabled with policies ensuring users can only access their own data:

- `SELECT`: Where `user_id = auth.uid()`
- `INSERT`: With check `user_id = auth.uid()`
- `UPDATE`: Where and check `user_id = auth.uid()`
- `DELETE`: Where `user_id = auth.uid()`

## Migrating Existing Data

If you have existing data in localStorage, the app will automatically migrate it when the user logs in. The migration happens in `financeDataService.ts`:

```typescript
import { migrateFromLocalStorage } from './utils/financeDataService'

// Call this after user login
const result = await migrateFromLocalStorage()
console.log(`Migrated ${result.synced} items`)
```

## Rollback

To rollback this migration:

```sql
DROP TABLE IF EXISTS public.net_worth_snapshots;
DROP TABLE IF EXISTS public.investments;
DROP TABLE IF EXISTS public.liabilities;
DROP TABLE IF EXISTS public.assets;

DROP FUNCTION IF EXISTS get_total_assets(UUID);
DROP FUNCTION IF EXISTS get_total_liabilities(UUID);
DROP FUNCTION IF EXISTS get_total_investments(UUID);
DROP FUNCTION IF EXISTS get_net_worth(UUID);
DROP FUNCTION IF EXISTS create_net_worth_snapshot(UUID, VARCHAR);
DROP FUNCTION IF EXISTS update_updated_at_column();
```

## Troubleshooting

### Error: "permission denied for table assets"

Make sure RLS policies are created. Run the policy creation SQL again.

### Error: "relation auth.users does not exist"

This happens if you're running on a non-Supabase Postgres. The migration requires Supabase's auth schema.

### Error: "function gen_random_uuid() does not exist"

Enable the `pgcrypto` extension:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```
