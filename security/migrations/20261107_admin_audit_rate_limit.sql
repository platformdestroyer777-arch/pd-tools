-- Limit resource-heavy read-only admin Pix audits.
-- Does not change or touch existing payments.
BEGIN;
CREATE TABLE IF NOT EXISTS pd_internal.admin_audit_rate_limits (
  user_id uuid PRIMARY KEY,
  window_started timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
ALTER TABLE pd_internal.admin_audit_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pd_internal.admin_audit_rate_limits FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.claim_admin_audit_slot(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_now timestamptz := now();
  v_attempts integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  INSERT INTO pd_internal.admin_audit_rate_limits AS limits
    (user_id,window_started,attempts)
  VALUES (p_user_id,v_now,1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started =
        CASE WHEN limits.window_started < v_now - INTERVAL '10 minutes'
             THEN v_now ELSE limits.window_started END,
      attempts =
        CASE WHEN limits.window_started < v_now - INTERVAL '10 minutes'
             THEN 1 ELSE limits.attempts + 1 END
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts <= 6;
END
$fn$;

REVOKE ALL ON FUNCTION public.claim_admin_audit_slot(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_audit_slot(uuid)
  TO service_role;
COMMIT;
