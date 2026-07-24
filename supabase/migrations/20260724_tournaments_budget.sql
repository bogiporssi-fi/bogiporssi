-- Aktiivisen turnauksen pelaajabudjetti (admin voi muuttaa; oletus 1 000 000 €).
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS budget integer NOT NULL DEFAULT 1000000;

COMMENT ON COLUMN public.tournaments.budget IS
  'Pelaajatorin budjettikatto euroina tälle turnaukselle (oletus 1000000).';
