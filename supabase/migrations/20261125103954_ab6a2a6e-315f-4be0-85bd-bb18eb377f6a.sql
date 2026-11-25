GRANT SELECT (id, panchayath_id, author_agent_id, title, body, is_published, created_at)
ON public.panchayath_virtual_office_announcements
TO anon, authenticated;

CREATE POLICY "Anyone can read published Virtual Office announcements"
ON public.panchayath_virtual_office_announcements
FOR SELECT TO anon, authenticated
USING (is_published = true);

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
SECURITY INVOKER
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
SECURITY INVOKER
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

CREATE INDEX IF NOT EXISTS idx_panchayath_virtual_office_announcements_author
ON public.panchayath_virtual_office_announcements(author_agent_id);

CREATE INDEX IF NOT EXISTS idx_panchayath_virtual_office_announcements_office_created
ON public.panchayath_virtual_office_announcements(panchayath_id, created_at DESC);