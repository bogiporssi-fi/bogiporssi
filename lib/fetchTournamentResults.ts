import { supabase } from './supabase';
import {
  TOURNAMENT_RESULTS_ORDER,
  TOURNAMENT_RESULTS_PAGE_SIZE,
  mergeTournamentResultPages,
} from './tournamentResultRows';

/**
 * Hakee kaikki tournament_results -rivit sivutettuna.
 * Supabase/PostgREST palauttaa oletuksena max 1000 riviä per kysely — ilman tätä
 * vanhimmat arkistoidut kisat katoavat historiasta ja kausipistelaskusta.
 *
 * Järjestys on created_at + id. Pelkkä created_at ei ole uniikki, ja sivun raja
 * tasatilanteen keskellä sekä duplikoi että pudottaa rivejä.
 */
export async function fetchAllTournamentResults(): Promise<any[]> {
  const pages: any[][] = [];
  let offset = 0;

  for (;;) {
    let query = supabase.from('tournament_results').select('*');
    for (const part of TOURNAMENT_RESULTS_ORDER) {
      query = query.order(part.column, { ascending: part.ascending });
    }
    const { data, error } = await query.range(offset, offset + TOURNAMENT_RESULTS_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    pages.push(data);
    if (data.length < TOURNAMENT_RESULTS_PAGE_SIZE) break;
    offset += TOURNAMENT_RESULTS_PAGE_SIZE;
  }

  return mergeTournamentResultPages(pages);
}
