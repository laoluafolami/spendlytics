/*
  # Fix user_id requirement for anonymous usage

  1. Changes
    - Make user_id nullable to allow anonymous expense tracking
    - Add default value for user_id using gen_random_uuid() for backward compatibility
  
  2. Security
    - Maintains existing RLS policies
    - Allows anonymous users to create expenses without authentication
*/

ALTER TABLE expenses 
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN user_id SET DEFAULT gen_random_uuid();
