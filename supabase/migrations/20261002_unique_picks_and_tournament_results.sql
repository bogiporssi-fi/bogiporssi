-- Estää oikeat duplikaatit valinnoissa ja kisa-arkistossa.
-- EI ajettu automaattisesti. Aja käsin Supabasen SQL-editorissa.
-- Jos CREATE UNIQUE INDEX epäonnistuu, taulussa on jo duplikaatteja:
-- älä poista rivejä tämän skriptin yhteydessä, vaan tarkista ne ensin.
-- Vaatii aiemman migraation 20260810 (tournament_results.entry_type).

-- Yksi valinta per manageri, kisa ja pelaaja.
CREATE UNIQUE INDEX IF NOT EXISTS picks_user_tournament_player_uidx
  ON public.picks (user_id, tournament_id, player_id)
  WHERE user_id IS NOT NULL
    AND tournament_id IS NOT NULL
    AND player_id IS NOT NULL;

-- Fantasy-rosteri: pelaaja kerran per manageri, turnaus ja kausiosa.
-- NULLS NOT DISTINCT niin tyhjä season_segment ei päästä kahta samaa riviä läpi.
CREATE UNIQUE INDEX IF NOT EXISTS tournament_results_roster_by_user_uidx
  ON public.tournament_results (tournament_name, season_segment, user_id, player_name, entry_type)
  NULLS NOT DISTINCT
  WHERE user_id IS NOT NULL;

-- Legacy- ja kenttärivit ilman user_id:tä erotellaan joukkueen nimellä.
CREATE UNIQUE INDEX IF NOT EXISTS tournament_results_roster_by_team_uidx
  ON public.tournament_results (tournament_name, season_segment, team_name, player_name, entry_type)
  NULLS NOT DISTINCT
  WHERE user_id IS NULL;
