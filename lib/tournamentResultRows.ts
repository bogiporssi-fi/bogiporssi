export const TOURNAMENT_RESULTS_PAGE_SIZE = 1000;

/**
 * created_at ei ole uniikki: sama arkistointibatch saa saman aikaleiman.
 * Ilman id-tasoitusta OFFSET/LIMIT voi palauttaa tasatilanteen rivin kahdelle sivulle
 * ja jättää toisen rivin kokonaan pois.
 */
export const TOURNAMENT_RESULTS_ORDER = [
  { column: 'created_at', ascending: false },
  { column: 'id', ascending: false },
] as const;

export function tournamentResultsOrderParam(): string {
  return TOURNAMENT_RESULTS_ORDER.map((part) => `${part.column}.${part.ascending ? 'asc' : 'desc'}`).join(',');
}

export function tournamentResultRowId(row: { id?: unknown } | null | undefined): string | null {
  if (row == null || row.id == null || row.id === '') return null;
  return String(row.id);
}

/** Yhdistää sivut niin, että sama rivitunnus esiintyy tasan kerran. Ensimmäinen esiintymä voittaa. */
export function mergeTournamentResultPages<T extends { id?: unknown }>(pages: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const rows: T[] = [];
  for (const page of pages) {
    for (const row of page) {
      const id = tournamentResultRowId(row);
      if (id != null) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      rows.push(row);
    }
  }
  return rows;
}

type RosterRow = {
  tournament_name?: unknown;
  season_segment?: unknown;
  user_id?: unknown;
  team_name?: unknown;
  player_name?: unknown;
  entry_type?: unknown;
};

function rosterOwnerKey(row: RosterRow): string {
  const uid = row.user_id;
  if (uid != null && String(uid).trim() !== '') return `uid:${String(uid)}`;
  return `team:${String(row.team_name ?? '')}`;
}

/**
 * Pelaaja kerran per (turnaus, season_segment, manageri).
 * Ilman user_id:tä manageri on joukkueen nimi, jotta legacy-rivit eivät yhdisty eri tiimien kesken.
 */
export function rosterPlayerDedupeKey(row: RosterRow | null | undefined): string | null {
  if (row == null) return null;
  const player = String(row.player_name ?? '').trim();
  if (!player) return null;
  const tournament = String(row.tournament_name ?? '');
  const segment =
    row.season_segment != null && row.season_segment !== '' && Number.isFinite(Number(row.season_segment))
      ? String(Number(row.season_segment))
      : '';
  const entry = String(row.entry_type || 'player');
  return `${tournament}\0${segment}\0${rosterOwnerKey(row)}\0${entry}\0${player}`;
}

/** Joukkuerosteri: sama pelaaja ei kerrytä pisteitä kahdesti samassa kisassa. */
export function dedupePlayersOncePerTeamRoster<T extends RosterRow>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = rosterPlayerDedupeKey(row);
    if (key == null) {
      out.push(row);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
