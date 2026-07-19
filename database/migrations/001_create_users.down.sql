-- Migration down: drop users table
DROP INDEX IF EXISTS idx_user_email;
DROP TABLE IF EXISTS User;
