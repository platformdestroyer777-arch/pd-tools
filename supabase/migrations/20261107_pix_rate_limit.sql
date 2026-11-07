-- Aplicar no Supabase antes de ativar a API Pix atualizada.
CREATE TABLE IF NOT EXISTS public.pix_checkout_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ten_min_started timestamptz NOT NULL DEFAULT now(),
  ten_min_count integer NOT NULL DEFAULT 0,
  day_started timestamptz NOT NULL DEFAULT now(),
  day_count integer NOT NULL DEFAULT 0
);
ALTER TABLE public.pix_checkout_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pix_checkout_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_pix_checkout_slot(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_at timestamptz := now();
  v_ten_min integer;
  v_day integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;
  INSERT INTO public.pix_checkout_rate_limits AS limits (
    user_id, ten_min_started, ten_min_count, day_started, day_count
  ) VALUES (p_user_id, v_at, 1, v_at, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    ten_min_started = CASE WHEN limits.ten_min_started < v_at - interval '10 minutes' THEN v_at ELSE limits.ten_min_started END,
    ten_min_count = CASE WHEN limits.ten_min_started < v_at - interval '10 minutes' THEN 1 ELSE limits.ten_min_count + 1 END,
    day_started = CASE WHEN limits.day_started < v_at - interval '24 hours' THEN v_at ELSE limits.day_started END,
    day_count = CASE WHEN limits.day_started < v_at - interval '24 hours' THEN 1 ELSE limits.day_count + 1 END
  RETURNING ten_min_count, day_count INTO v_ten_min, v_day;
  RETURN v_ten_min <= 4 AND v_day <= 24;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_pix_checkout_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pix_checkout_slot(uuid) TO service_role;
