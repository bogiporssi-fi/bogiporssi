-- Arkistointi ("Uusi kisa") tallentaa fantasy-pisteet tähän sarakkeeseen.
-- Ilman tätä Supabase palauttaa: Could not find the 'earned_points' column ...

ALTER TABLE public.tournament_results
  ADD COLUMN IF NOT EXISTS earned_points integer;

COMMENT ON COLUMN public.tournament_results.earned_points IS
  'Fantasy-pisteet tälle pelaajalle tässä turnauksessa (arkistointi).';
