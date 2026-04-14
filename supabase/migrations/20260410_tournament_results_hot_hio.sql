-- Hot round / HIO arkistoon, jotta HoF voi summata koko kauden (ei vain nykyinen players-rivi).

ALTER TABLE public.tournament_results
  ADD COLUMN IF NOT EXISTS hot_rounds integer,
  ADD COLUMN IF NOT EXISTS hio_count integer;

COMMENT ON COLUMN public.tournament_results.hot_rounds IS 'Pelaajan hot round -lukumäärä kyseisessä arkistoidussa kisassa.';
COMMENT ON COLUMN public.tournament_results.hio_count IS 'Pelaajan HIO-lukumäärä kyseisessä arkistoidussa kisassa.';
