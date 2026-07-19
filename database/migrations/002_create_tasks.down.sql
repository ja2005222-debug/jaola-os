-- Migration down: drop tasks table
DROP INDEX IF EXISTS idx_task_due_date;
DROP INDEX IF EXISTS idx_task_status;
DROP INDEX IF EXISTS idx_task_user_id;
DROP TABLE IF EXISTS Task;
