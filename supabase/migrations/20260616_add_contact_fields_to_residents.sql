-- Migration: Add contact fields to residents table
-- Target: Supabase Database

-- 1. Add phone column if not exists
ALTER TABLE residents ADD COLUMN IF NOT EXISTS phone text;

-- 2. Add email column if not exists
ALTER TABLE residents ADD COLUMN IF NOT EXISTS email text;

-- Comment for documentation
COMMENT ON COLUMN residents.phone IS 'Numéro de mobile du résident';
COMMENT ON COLUMN residents.email IS 'Adresse e-mail du résident';
