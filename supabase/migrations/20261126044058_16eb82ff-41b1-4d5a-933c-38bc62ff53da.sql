ALTER TABLE public.panchayath_virtual_office_magic_words ALTER COLUMN author_agent_id DROP NOT NULL;
ALTER TABLE public.panchayath_virtual_office_magic_words ADD COLUMN author_admin_id uuid REFERENCES public.admins(id) ON DELETE SET NULL;
ALTER TABLE public.panchayath_virtual_office_magic_words ADD COLUMN author_user_id uuid;
CREATE INDEX idx_vo_magic_words_author_admin ON public.panchayath_virtual_office_magic_words(author_admin_id);