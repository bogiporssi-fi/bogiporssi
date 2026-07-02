import { supabase } from './supabase';

const PAGE_SIZE = 1000;

/**
 * Hakee kaikki tournament_results -rivit sivutettuna.
 * Supabase/PostgREST palauttaa oletuksena max 1000 riviä per kysely — ilman tätä
 * vanhimmat arkistoidut kisat katoavat historiasta ja kausipistelaskusta.
 */
export async function fetchAllTournamentResults(): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('tournament_results')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}
