-- PD Tools: MFA de administração com ativação gradual e sem ampliar acesso ao auth.
-- Aplicar antes de liberar a UI de inscrição. Uma conta sem MFA continua
-- funcionando; após a inscrição verificada, o próprio usuário ativa o bloqueio.
-- A coluna require_mfa não pode ser alterada diretamente por clientes Auth.
BEGIN;

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS require_mfa boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enable_admin_mfa()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL OR (SELECT auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2' THEN
    RETURN false;
  END IF;
  -- A função roda com permissões de owner; não conceder SELECT em auth.mfa_factors.
  IF NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors AS f
    WHERE f.user_id = v_user_id AND f.status = 'verified'
  ) THEN
    RETURN false;
  END IF;
  UPDATE public.admins AS a
  SET require_mfa = true
  WHERE a.user_id = v_user_id;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.enable_admin_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enable_admin_mfa() TO authenticated;

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
