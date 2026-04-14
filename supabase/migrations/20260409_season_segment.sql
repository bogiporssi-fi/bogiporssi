-- Erottaa arkistoidut kierrokset: sama näyttönimi ei tuplaa kausi-/HoF-laskentaa.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS season_segment integer NOT NULL DEFAULT 1;

ALTER TABLE public.tournament_results
  ADD COLUMN IF NOT EXISTS season_segment integer;

COMMENT ON COLUMN public.tournaments.season_segment IS
  'Kasvaa jokaisella Uusi kisa -arkistoinnilla. Aktiivinen kisa = tämä osa; arkisto tallentaa päättyneen osan numeron.';

COMMENT ON COLUMN public.tournament_results.season_segment IS
  'Monesko kausi-osio tämä arkistorivi edustaa (tallennushetken tournaments.season_segment).';
