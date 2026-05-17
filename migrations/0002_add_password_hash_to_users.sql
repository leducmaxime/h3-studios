-- Add password_hash column to users table for client account authentication
ALTER TABLE users ADD COLUMN password_hash TEXT;