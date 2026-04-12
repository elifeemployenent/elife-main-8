CREATE TABLE public.whatsapp_bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,
  alt_keyword text,
  label text NOT NULL,
  response_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_bot_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view commands" ON public.whatsapp_bot_commands
  FOR SELECT TO public USING (true);

CREATE POLICY "Super admin can manage commands" ON public.whatsapp_bot_commands
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_whatsapp_bot_commands_updated_at
  BEFORE UPDATE ON public.whatsapp_bot_commands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();