-- Kierroskohtainen erittely (JSON) — valinnainen, täydentää aggregaatteja
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS round_breakdown jsonb;

COMMENT ON COLUMN public.players.round_breakdown IS
  'JSON-taulukko: [{ "n": 1, "par": -3, "hot": 0, "hio": 0 }, ...] — kierroskohtainen tulos fantasy-laskentaan';
