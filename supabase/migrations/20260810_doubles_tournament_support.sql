-- Yhden kilpailun MPO-paritila. Muutokset ovat additiivisia ja vanha data
-- tulkitaan oletuksilla tavallisiksi singles-kisoiksi ja pelaajariveiksi.
BEGIN;

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'singles';

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS pre_pairs_state jsonb;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS pair_members jsonb;

ALTER TABLE public.tournament_results
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'player';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_format_check'
  ) THEN
    ALTER TABLE public.tournaments
      ADD CONSTRAINT tournaments_format_check
      CHECK (format IN ('singles', 'mpo_pairs'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournament_results_entry_type_check'
  ) THEN
    ALTER TABLE public.tournament_results
      ADD CONSTRAINT tournament_results_entry_type_check
      CHECK (entry_type IN ('player', 'pair'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_pair_members_check'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_pair_members_check
      CHECK (
        pair_members IS NULL
        OR (
          jsonb_typeof(pair_members) = 'array'
          AND jsonb_array_length(pair_members) = 2
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.tournaments.format IS
  'singles = normaali 5 pelaajan kilpailu, mpo_pairs = 3 MPO-parin kilpailu';
COMMENT ON COLUMN public.tournaments.pre_pairs_state IS
  'Palautussnapshot ennen doubles-kentän aktivointia';
COMMENT ON COLUMN public.players.pair_members IS
  'Doubles-parin kahden jäsenen nimet, ratingit ja paikkatiedot';
COMMENT ON COLUMN public.tournament_results.entry_type IS
  'player = yksittäinen pelaaja, pair = doubles-pari';

COMMIT;
