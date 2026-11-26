CREATE TABLE public.panchayath_virtual_office_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, work_date)
);
GRANT ALL ON public.panchayath_virtual_office_attendance TO service_role;
ALTER TABLE public.panchayath_virtual_office_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages Virtual Office attendance" ON public.panchayath_virtual_office_attendance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_virtual_office_attendance_updated_at BEFORE UPDATE ON public.panchayath_virtual_office_attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.panchayath_virtual_office_magic_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panchayath_id uuid NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  author_agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE RESTRICT,
  word_date date NOT NULL,
  content_type text NOT NULL DEFAULT 'word',
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (panchayath_id, word_date)
);
GRANT ALL ON public.panchayath_virtual_office_magic_words TO service_role;
ALTER TABLE public.panchayath_virtual_office_magic_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages Virtual Office Magic Words" ON public.panchayath_virtual_office_magic_words FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_virtual_office_magic_words_updated_at BEFORE UPDATE ON public.panchayath_virtual_office_magic_words FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.panchayath_virtual_office_magic_word_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  magic_word_id uuid NOT NULL REFERENCES public.panchayath_virtual_office_magic_words(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (magic_word_id, agent_id)
);
GRANT ALL ON public.panchayath_virtual_office_magic_word_views TO service_role;
ALTER TABLE public.panchayath_virtual_office_magic_word_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages Virtual Office Magic Word views" ON public.panchayath_virtual_office_magic_word_views FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_virtual_office_magic_word_views_updated_at BEFORE UPDATE ON public.panchayath_virtual_office_magic_word_views FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_vo_attendance_date ON public.panchayath_virtual_office_attendance(work_date, agent_id);
CREATE INDEX idx_vo_magic_words_date ON public.panchayath_virtual_office_magic_words(panchayath_id, word_date DESC);
CREATE INDEX idx_vo_magic_word_views_word ON public.panchayath_virtual_office_magic_word_views(magic_word_id, seen_at DESC);