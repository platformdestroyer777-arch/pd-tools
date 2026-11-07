-- Aplicado em produção 07/11/2026. Reaplicável sem alterar registros.
-- PostgREST usa RLS para DML; TRUNCATE não se submete à filtragem RLS.
BEGIN;
REVOKE SELECT ON TABLE public.admins FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.tools, public.site_settings
  FROM authenticated;
COMMIT;
