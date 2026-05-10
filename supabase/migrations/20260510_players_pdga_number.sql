-- PDGA-profiilinkkiä varten (vakio-URL https://www.pdga.com/player/{numero})
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS pdga_number integer NULL;

COMMENT ON COLUMN public.players.pdga_number IS 'PDGA player number; profile https://www.pdga.com/player/{pdga_number}';
