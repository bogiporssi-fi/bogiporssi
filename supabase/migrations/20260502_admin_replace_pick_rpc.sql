-- Pelaajavaihto ilman picks UPDATE -policya: funktio ajaa päivityksen table owner -oikeuksilla (RLS ohitetaan).
-- Admin-tunnistus: JWT:n sähköposti (email tai user_metadata.email). Muuta expected_email tarvittaessa.

CREATE OR REPLACE FUNCTION public.admin_replace_pick(
  p_pick_id uuid,
  p_new_player_id uuid,
  p_buy_price numeric,
  p_tournament_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  jwt_raw jsonb;
  jwt_email text;
  expected_email text := 'kimmo@gmail.com';
BEGIN
  jwt_raw := coalesce(auth.jwt(), '{}'::jsonb);
  jwt_email := lower(trim(coalesce(
    jwt_raw->>'email',
    jwt_raw->'user_metadata'->>'email',
    jwt_raw->'app_metadata'->>'email',
    ''
  )));

  IF jwt_email IS DISTINCT FROM lower(trim(expected_email)) THEN
    RAISE EXCEPTION 'admin_replace_pick: JWT email "%" does not match "%"', jwt_email, expected_email
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.picks
  SET
    player_id = p_new_player_id,
    buy_price = p_buy_price,
    earned_points = 0
  WHERE id = p_pick_id
    AND tournament_id = p_tournament_id
  RETURNING id INTO rid;

  RETURN rid;
END;
$$;

ALTER FUNCTION public.admin_replace_pick(uuid, uuid, numeric, uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_replace_pick(uuid, uuid, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_replace_pick(uuid, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_pick(uuid, uuid, numeric, uuid) TO service_role;

COMMENT ON FUNCTION public.admin_replace_pick(uuid, uuid, numeric, uuid) IS 'Admin vaihtaa pick-rivin pelaajan; ohittaa RLS:n.';
