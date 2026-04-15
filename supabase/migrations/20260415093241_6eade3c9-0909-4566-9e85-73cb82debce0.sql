
CREATE TABLE public.agent_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  complaint_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_remarks text,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view complaints" ON public.agent_complaints FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert complaints" ON public.agent_complaints FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Super admin can manage complaints" ON public.agent_complaints FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can manage complaints" ON public.agent_complaints FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
