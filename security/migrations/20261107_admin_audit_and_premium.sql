-- PD Tools: defence in depth for MFA, audited administrative edits and paid access.
-- Safe prerequisites: existing administrators must have verified TOTP.
-- This migration preserves existing tools, subscriptions and payment data.
BEGIN;

DO $preflight$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.admins a
   WHERE NOT EXISTS (
     SELECT 1 FROM auth.mfa_factors f
     WHERE f.user_id = a.user_id AND f.status = 'verified'
   )
 ) THEN
   RAISE EXCEPTION 'Existing administrator without verified MFA. Configure MFA before migrating.';
 END IF;
END
$preflight$;

ALTER TABLE public.admins ALTER COLUMN require_mfa SET DEFAULT true;

-- Admin authorization must never fall back to a password-only session,
-- regardless of the require_mfa column on newly created admin records.
ALTER POLICY "Admins can manage tools" ON public.tools
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND (SELECT auth.jwt()->>'aal') = 'aal2'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND (SELECT auth.jwt()->>'aal') = 'aal2'
    )
  );

ALTER POLICY "Admins can manage settings" ON public.site_settings
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND (SELECT auth.jwt()->>'aal') = 'aal2'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND (SELECT auth.jwt()->>'aal') = 'aal2'
    )
  );

ALTER POLICY "PD admins can upload site assets" ON storage.objects
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-assets' AND EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND (SELECT auth.jwt()->>'aal') = 'aal2'
    )
  );

ALTER POLICY "PD admins can update site assets" ON storage.objects
  TO authenticated
  USING (
    bucket_id = 'site-assets' AND EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND (SELECT auth.jwt()->>'aal') = 'aal2'
    )
  )
  WITH CHECK (
    bucket_id = 'site-assets' AND EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND (SELECT auth.jwt()->>'aal') = 'aal2'
    )
  );

ALTER POLICY "PD admins can view site assets" ON storage.objects
  TO authenticated
  USING (
    bucket_id = 'site-assets' AND EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND (SELECT auth.jwt()->>'aal') = 'aal2'
    )
  );

-- Internal schema is not part of the Supabase exposed REST API.
CREATE SCHEMA IF NOT EXISTS pd_internal;
REVOKE ALL ON SCHEMA pd_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS pd_internal.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  table_name text NOT NULL CHECK (table_name IN ('admins','tools','site_settings')),
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  record_id text,
  previous_value jsonb,
  new_value jsonb
);
ALTER TABLE pd_internal.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pd_internal.admin_audit_log FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON pd_internal.admin_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION pd_internal.record_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
 v_before jsonb;
 v_after jsonb;
 v_key text;
BEGIN
 IF TG_OP <> 'INSERT' THEN
   v_before := to_jsonb(OLD);
 END IF;
 IF TG_OP <> 'DELETE' THEN
   v_after := to_jsonb(NEW);
 END IF;

 v_key := COALESCE(v_after->>'id', v_after->>'user_id',
                    v_before->>'id', v_before->>'user_id', 'site');
 IF TG_TABLE_NAME = 'site_settings' THEN
   v_key := 'site';
 END IF;

 INSERT INTO pd_internal.admin_audit_log
   (actor_id, table_name, operation, record_id, previous_value, new_value)
 VALUES
   (auth.uid(), TG_TABLE_NAME, TG_OP, v_key, v_before, v_after);

 IF TG_OP = 'DELETE' THEN
   RETURN OLD;
 END IF;
 RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION pd_internal.record_admin_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pd_audit_tools_change ON public.tools;
CREATE TRIGGER pd_audit_tools_change
 AFTER INSERT OR UPDATE OR DELETE ON public.tools
 FOR EACH ROW EXECUTE FUNCTION pd_internal.record_admin_change();

DROP TRIGGER IF EXISTS pd_audit_settings_change ON public.site_settings;
CREATE TRIGGER pd_audit_settings_change
 AFTER INSERT OR UPDATE OR DELETE ON public.site_settings
 FOR EACH ROW EXECUTE FUNCTION pd_internal.record_admin_change();

DROP TRIGGER IF EXISTS pd_audit_admins_change ON public.admins;
CREATE TRIGGER pd_audit_admins_change
 AFTER INSERT OR UPDATE OR DELETE ON public.admins
 FOR EACH ROW EXECUTE FUNCTION pd_internal.record_admin_change();

-- Immutable record of premium access granted by the payment RPC.
CREATE TABLE IF NOT EXISTS pd_internal.premium_grant_events (
  payment_id uuid PRIMARY KEY REFERENCES public.premium_payments(id),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE pd_internal.premium_grant_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pd_internal.premium_grant_events FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS premium_grants_user_time_idx
  ON pd_internal.premium_grant_events (user_id,created_at DESC);

-- Grant exactly one 30-day period per approved R$5 subscription.
-- No public RPC access, no client-controlled amount or duration.
CREATE OR REPLACE FUNCTION public.confirmar_pagamento_premium(
 p_payment_id uuid, p_provider_order_id text, p_provider_payment_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
 v_user_id uuid;
 v_expiration timestamptz;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'Acesso não autorizado';
 END IF;

 UPDATE public.premium_payments
 SET status = 'approved', paid_at = now()
 WHERE id = p_payment_id
   AND provider = 'mercadopago'
   AND provider_order_id = p_provider_order_id
   AND provider_payment_id = p_provider_payment_id
   AND amount = 5.00
   AND currency = 'BRL'
   AND payment_type = 'subscription'
   AND status = 'pending'
 RETURNING user_id INTO v_user_id;

 IF v_user_id IS NULL THEN
   RETURN false;
 END IF;

 INSERT INTO public.premium_access (user_id,expires_at)
 VALUES (v_user_id, now() + INTERVAL '30 days')
 ON CONFLICT (user_id) DO UPDATE
 SET expires_at = greatest(public.premium_access.expires_at,now())
                  + INTERVAL '30 days'
 RETURNING expires_at INTO v_expiration;

 INSERT INTO pd_internal.premium_grant_events
   (payment_id,user_id,expires_at)
 VALUES (p_payment_id,v_user_id,v_expiration);

 RETURN true;
END
$fn$;

REVOKE ALL ON FUNCTION public.confirmar_pagamento_premium(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_premium(uuid,text,text)
  TO service_role;

COMMIT;
