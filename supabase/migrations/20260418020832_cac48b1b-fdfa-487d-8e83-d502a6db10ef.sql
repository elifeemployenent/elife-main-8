CREATE POLICY "Public can self-register as pending agent"
ON public.pennyekart_agents
FOR INSERT
TO public
WITH CHECK (is_active = false);