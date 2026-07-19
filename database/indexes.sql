-- Indexes justification:
-- idx_task_user_id: used in JOINs and queries filtering by user
-- idx_task_status: used in filtering tasks by status (pending/completed)
-- idx_task_due_date: used in sorting/filtering by due date
-- idx_user_email: used in login queries (lookup by email)

CREATE INDEX IF NOT EXISTS idx_task_user_id ON Task(user_id);
CREATE INDEX IF NOT EXISTS idx_task_status ON Task(status);
CREATE INDEX IF NOT EXISTS idx_task_due_date ON Task(due_date);
CREATE INDEX IF NOT EXISTS idx_user_email ON User(email);
