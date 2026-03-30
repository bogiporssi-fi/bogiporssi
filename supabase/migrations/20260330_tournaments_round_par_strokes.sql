-- Kierroksen tavoiteheitot (par) — sama kaikille kierroksille tässä turnauksessa; käytetään rd_N-sarakkeiden muuntamiseen par-eroiksi
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS round_par_strokes integer;

COMMENT ON COLUMN public.tournaments.round_par_strokes IS
  'Esimerkiksi 54 — rd_N-heitot vähennetään tästä CSV-tuonnissa (kierroksen par-ero fantasy-laskentaan)';
