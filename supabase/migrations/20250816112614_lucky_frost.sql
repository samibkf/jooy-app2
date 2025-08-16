/*
  # Add metadata column to documents table

  1. Changes
    - Add `metadata` column to `documents` table to store auto mode data
    - The column will be JSONB type to store structured data
    - This enables dual-mode support (regions mode vs auto mode)

  2. Security
    - No changes to RLS policies needed as this uses existing table structure
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE documents ADD COLUMN metadata JSONB;
  END IF;
END $$;