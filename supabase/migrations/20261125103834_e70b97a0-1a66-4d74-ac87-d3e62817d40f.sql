CREATE TABLE public.panchayath_virtual_office_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panchayath_id uuid NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  author_agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.panchayath_virtual_office_announcements TO service_role;
ALTER TABLE public.panchayath_virtual_office_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages Virtual Office announcements"
ON public.panchayath_virtual_office_announcements
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_panchayath_virtual_office_announcements_updated_at
BEFORE UPDATE ON public.panchayath_virtual_office_announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.get_public_virtual_office_agents(_panchayath_id uuid)
RETURNS TABLE (
  agent_id uuid,
  display_name text,
  role_key text,
  ward text,
  parent_agent_id uuid,
  parent_agent_name text,
  parent_role_key text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.id,
    a.name,
    a.role,
    a.ward,
    a.parent_agent_id,
    parent.name,
    parent.role
  FROM public.pennyekart_agents a
  JOIN public.panchayaths p
    ON p.id = _panchayath_id
    AND p.is_active IS DISTINCT FROM false
  LEFT JOIN public.pennyekart_agents parent
    ON parent.id = a.parent_agent_id
    AND parent.is_active IS DISTINCT FROM false
  WHERE a.is_active IS DISTINCT FROM false
    AND (
      a.panchayath_id = _panchayath_id
      OR _panchayath_id = ANY(COALESCE(a.responsible_panchayath_ids, ARRAY[]::uuid[]))
    )
  ORDER BY a.role, a.name;
$$;

REVOKE ALL ON FUNCTION public.get_public_virtual_office_agents(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_virtual_office_agents(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_virtual_office_announcements(_panchayath_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  author_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    notice.id,
    notice.title,
    notice.body,
    agent.name,
    notice.created_at
  FROM public.panchayath_virtual_office_announcements notice
  JOIN public.panchayaths p
    ON p.id = notice.panchayath_id
    AND p.is_active IS DISTINCT FROM false
  JOIN public.panchayath_virtual_offices office
    ON office.panchayath_id = notice.panchayath_id
  LEFT JOIN public.pennyekart_agents agent
    ON agent.id = notice.author_agent_id
  WHERE notice.panchayath_id = _panchayath_id
    AND notice.is_published = true
  ORDER BY notice.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_virtual_office_announcements(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_virtual_office_announcements(uuid) TO anon, authenticated;