-- Endurecimento de privilégio e otimização das policies já aplicados em produção em 07/11/2026.
-- Não modifica registros, acessos Premium, ferramentas, usuários ou cobranças.
-- Idempotente para as políticas e permissões existentes neste projeto.
BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.tools, public.site_settings, public.admins
FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.admins
FROM authenticated;

CREATE INDEX IF NOT EXISTS premium_payments_user_id_idx
ON public.premium_payments (user_id);

ALTER POLICY "Admins can read own record" ON public.admins
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can view own payments" ON public.premium_payments
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Admins can manage tools" ON public.tools
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = (SELECT auth.uid())));

ALTER POLICY "Admins can manage settings" ON public.site_settings
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = (SELECT auth.uid())));

COMMIT;
