-- Turnauskohtainen hinnoittelutapa. Oletus absolute pitää nykyisen
-- rating-kaavan, joten olemassa olevat ja vanhat kisat eivät muutu.
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'absolute';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_pricing_mode_check'
  ) THEN
    ALTER TABLE public.tournaments
      ADD CONSTRAINT tournaments_pricing_mode_check
      CHECK (pricing_mode IN ('absolute', 'relative'));
  END IF;
END
$$;

COMMENT ON COLUMN public.tournaments.pricing_mode IS
  'absolute = rating-kaava max(130000,(rating-950)*2600). relative = suhteellinen hinnoittelu pelaajan sijoituksen mukaan tässä kentässä (heikompi kenttä). Budjetti ja rosterin koko eivät riipu tästä.';
