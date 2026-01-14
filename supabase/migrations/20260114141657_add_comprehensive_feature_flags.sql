/*
  # Add Comprehensive Feature Flags

  ## Overview
  This migration adds extensive feature flags to the app_settings table
  to enable/disable various advanced features in the expense tracker.

  ## New Feature Flags

  ### Budget & Goals (Enhanced)
    - `feature_budget_alerts` - Budget limit alerts
    - `feature_savings_goals` - Savings goal tracking
    
  ### Reports & Insights
    - `feature_reports` - Basic reports
    - `feature_spending_trends` - Spending trends and predictions
    - `feature_notifications` - Weekly/monthly summaries
    - `feature_unusual_spending` - Unusual spending pattern detection
    - `feature_tax_reports` - Tax-ready business expense reports
    
  ### Better Filtering & Search (Enhanced)
    - `feature_date_range_filter` - Date range filtering
    - `feature_amount_range_filter` - Amount range filtering
    - `feature_saved_filters` - Save and reuse filter presets
    
  ### Import & Export
    - `feature_import_csv` - Import from CSV/bank statements
    - `feature_auto_categorize` - Auto-categorize imports
    - `feature_export_excel` - Export to Excel/CSV
    - `feature_auto_backup` - Scheduled automatic backup
    
  ### Smart Features
    - `feature_bill_reminders` - Reminders for recurring bills
    - `feature_custom_categories` - Custom category creation
    - `feature_multi_currency` - Multiple currencies per expense
    - `feature_exchange_rates` - Exchange rate conversion

  ## Changes
    - Add new columns to app_settings table with default values
*/

-- Add Budget & Goals enhanced features
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_budget_alerts boolean DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_savings_goals boolean DEFAULT true;

-- Add Reports & Insights features
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_reports boolean DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_spending_trends boolean DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_notifications boolean DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_unusual_spending boolean DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_tax_reports boolean DEFAULT false;

-- Add Better Filtering & Search enhanced features
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_date_range_filter boolean DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_amount_range_filter boolean DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_saved_filters boolean DEFAULT true;

-- Add Import & Export features
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_import_csv boolean DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_auto_categorize boolean DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_export_excel boolean DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_auto_backup boolean DEFAULT false;

-- Add Smart Features
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_bill_reminders boolean DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_custom_categories boolean DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_multi_currency boolean DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_exchange_rates boolean DEFAULT false;