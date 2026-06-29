
-- 1. Create the agent_direct_customers table
CREATE TABLE public.agent_direct_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  mobile text NOT NULL,
  ward text,
  address text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (agent_id, mobile)
);

CREATE INDEX agent_direct_customers_agent_id_idx ON public.agent_direct_customers(agent_id);

-- 2. GRANTs (public read, writes via edge function)
GRANT SELECT ON public.agent_direct_customers TO anon;
GRANT SELECT ON public.agent_direct_customers TO authenticated;
GRANT ALL ON public.agent_direct_customers TO service_role;

-- 3. RLS
ALTER TABLE public.agent_direct_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view direct customers"
  ON public.agent_direct_customers
  FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE denied from client (no policies = denied). Edge function uses service_role to bypass.

-- 4. updated_at trigger
CREATE TRIGGER set_agent_direct_customers_updated_at
  BEFORE UPDATE ON public.agent_direct_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
