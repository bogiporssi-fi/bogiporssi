-- Kierroskohtaiset tavoiteheitot (par) rd_*-tuontiin — lista järjestyksessä rd_1, rd_2, …
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS round_par_strokes_per_round integer[];

COMMENT ON COLUMN public.tournaments.round_par_strokes_per_round IS
  'Esim. {54,54,58}: rd_1 vähentää 54, rd_2 vähentää 54, rd_3 vähentää 58. Kun NULL, käytetään round_par_strokes (yksi luku kaikille).';
