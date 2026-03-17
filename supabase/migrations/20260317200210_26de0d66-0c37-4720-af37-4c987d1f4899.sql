
-- Agent Tasks table
CREATE TABLE public.pennyekart_agent_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  panchayath_id UUID NOT NULL REFERENCES public.panchayaths(id),
  created_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent Task Feedback table
CREATE TABLE public.pennyekart_agent_task_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.pennyekart_agent_tasks(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'not_completed')),
  remarks TEXT,
  feedback_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, agent_id)
);

-- RLS for tasks
ALTER TABLE public.pennyekart_agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view agent tasks" ON public.pennyekart_agent_tasks
  FOR SELECT TO public USING (true);

CREATE POLICY "Super admin can manage agent tasks" ON public.pennyekart_agent_tasks
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage agent tasks" ON public.pennyekart_agent_tasks
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS for feedback
ALTER TABLE public.pennyekart_agent_task_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view task feedback" ON public.pennyekart_agent_task_feedback
  FOR SELECT TO public USING (true);

CREATE POLICY "Super admin can manage task feedback" ON public.pennyekart_agent_task_feedback
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage task feedback" ON public.pennyekart_agent_task_feedback
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_agent_tasks_updated_at BEFORE UPDATE ON public.pennyekart_agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_agent_task_feedback_updated_at BEFORE UPDATE ON public.pennyekart_agent_task_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
