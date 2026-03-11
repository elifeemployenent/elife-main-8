
CREATE TABLE public.agent_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  work_details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, work_date)
);

ALTER TABLE public.agent_work_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can read work logs (public feature)
CREATE POLICY "Work logs viewable by everyone" ON public.agent_work_logs
  FOR SELECT TO public USING (true);

-- Anyone can insert work logs (agent self-service via mobile lookup)
CREATE POLICY "Anyone can insert work logs" ON public.agent_work_logs
  FOR INSERT TO public WITH CHECK (true);

-- Anyone can update work logs (only today's enforced in app)
CREATE POLICY "Anyone can update work logs" ON public.agent_work_logs
  FOR UPDATE TO public USING (work_date = CURRENT_DATE);

-- Anyone can delete work logs (only today's enforced in app)
CREATE POLICY "Anyone can delete work logs" ON public.agent_work_logs
  FOR DELETE TO public USING (work_date = CURRENT_DATE);

-- Trigger for updated_at
CREATE TRIGGER update_agent_work_logs_updated_at
  BEFORE UPDATE ON public.agent_work_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
