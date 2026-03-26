-- Yhdistää kausitilastot manageriin vaikka joukkueen nimi vaihtuisi.
-- Vanhat rivit voivat olla ilman user_id; sovellus käyttää silloin legacy-avainta.

ALTER TABLE public.tournament_results
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tournament_results_user_id_idx
  ON public.tournament_results (user_id);

COMMENT ON COLUMN public.tournament_results.user_id IS 'Managerin profiili-ID; täytetään arkistoinnissa.';

-- Täytä vanhat rivit vain jos joukkueen nimi vastaa täsmälleen yhtä profiilia (ei törmäyksiä).
UPDATE public.tournament_results tr
SET user_id = p.id
FROM public.profiles p
WHERE tr.user_id IS NULL
  AND tr.team_name IS NOT NULL
  AND tr.team_name = p.team_name
  AND (
    SELECT COUNT(*)::int FROM public.profiles p2 WHERE p2.team_name = tr.team_name
  ) = 1;
