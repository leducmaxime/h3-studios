-- Migration: Add UNIQUE constraint on users.email + normalize existing emails
-- Step 1: Remove duplicate emails (keep the most recently updated record)
DELETE FROM users
WHERE rowid NOT IN (
  SELECT MAX(rowid)
  FROM users
  WHERE email IS NOT NULL
  GROUP BY LOWER(TRIM(email))
);

-- Step 2: Normalize all existing emails to lowercase
UPDATE users
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL;

-- Step 3: Add UNIQUE constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);
