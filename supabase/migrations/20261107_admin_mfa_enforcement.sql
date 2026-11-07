-- PD Tools: MFA de administração com ativação gradual e sem ampliar acesso ao auth.
-- Aplicar antes de liberar a UI de inscrição. Uma conta sem MFA continua
-- funcionando; após a inscrição verificada, um endpoint autenticado de backend ativa o bloqueio.
-- A coluna require_mfa não pode ser alterada diretamente por clientes Auth.
BEGIN;

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS require_mfa boolean NOT NULL DEFAULT false;

-- A ativação agora é feita por /api/admin-mfa-enable, após
-- validar JWT e AAL2 no Supabase Auth, sem RPC SECURITY DEFINER pública.
DROP FUNCTION IF EXISTS public.enable_admin_mfa();

ALTER POLICY "Admins can manage tools" ON public.tools
USING (
  EXISTS (
    SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
    AND (NOT a.require_mfa OR (SELECT auth.jwt() ->> 'aal') = 'aal2')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
    AND (NOT a.require_mfa OR (SELECT auth.jwt() ->> 'aal') = 'aal2')
  )
);

ALTER POLICY "Admins can manage settings" ON public.site_settings
USING (
  EXISTS (
    SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
    AND (NOT a.require_mfa OR (SELECT auth.jwt() ->> 'aal') = 'aal2')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
    AND (NOT a.require_mfa OR (SELECT auth.jwt() ->> 'aal') = 'aal2')
  )
);

ALTER POLICY "PD admins can view site assets" ON storage.objects
USING (
  bucket_id = 'site-assets' AND
  EXISTS (SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
    AND (NOT a.require_mfa OR (SELECT auth.jwt() ->> 'aal') = 'aal2'))
);

ALTER POLICY "PD admins can upload site assets" ON storage.objects
WITH CHECK (
  bucket_id = 'site-assets' AND
  EXISTS (SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
    AND (NOT a.require_mfa OR (SELECT auth.jwt() ->> 'aal') = 'aal2'))
);

ALTER POLICY "PD admins can update site assets" ON storage.objects
USING (
  bucket_id = 'site-assets' AND
  EXISTS (SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
    AND (NOT a.require_mfa OR (SELECT auth.jwt() ->> 'aal') = 'aal2'))
)
WITH CHECK (
  bucket_id = 'site-assets' AND
  EXISTS (SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
    AND (NOT a.require_mfa OR (SELECT auth.jwt() ->> 'aal') = 'aal2'))
);

COMMIT;
