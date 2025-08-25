-- Fix database schema by adding missing columns
-- Run this to fix the column mismatch errors

-- Add missing columns to rooms table
ALTER TABLE rooms ADD COLUMN room_type TEXT DEFAULT 'Standard';
ALTER TABLE rooms ADD COLUMN is_active INTEGER DEFAULT 1;

-- Add missing columns to menu_items table (if they don't exist)
-- Note: category and is_available should already exist, but let's make sure

-- Update existing rooms with proper room types based on room numbers
UPDATE rooms SET room_type = 'Standard' WHERE number LIKE '1%';
UPDATE rooms SET room_type = 'Deluxe' WHERE number LIKE '2%';  
UPDATE rooms SET room_type = 'Premium' WHERE number LIKE '3%';

-- Make sure all rooms are active by default
UPDATE rooms SET is_active = 1 WHERE is_active IS NULL;

-- Make sure all menu items are available by default (if is_available column exists)
UPDATE menu_items SET is_available = 1 WHERE is_available IS NULL;
