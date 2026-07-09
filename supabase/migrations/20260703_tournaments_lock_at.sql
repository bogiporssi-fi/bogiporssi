-- Ajastettu turnauksen lukitus (admin asettaa lock_at; sovellus tulkitsee lukituksen automaattisesti).
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS lock_at timestamptz NULL;

COMMENT ON COLUMN public.tournaments.lock_at IS
  'Jos asetettu ja aika on mennyt, turnaus käsitellään lukittuna (is_locked voi olla vielä false).';
