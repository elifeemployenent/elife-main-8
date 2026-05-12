
ALTER TABLE public.department_work_logs ADD COLUMN IF NOT EXISTS created_by_member_id uuid;
ALTER TABLE public.department_work_logs ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.department_plans ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.department_todos ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Backfill creator for existing logs from member_id
UPDATE public.department_work_logs SET created_by_member_id = member_id WHERE created_by_member_id IS NULL;
