import { breakdownFromPlayerRow, type PointsBreakdown } from './pointsBreakdown';

export type { PointsBreakdown };

/**
 * Pelaajakohtaiset fantasy-pisteet: sama earned_points -logiikka kuin Historia-näkymässä.
 */
export function earnedPointsFromHistoryRow(row: any): number {
  const par = Number(row.player_score) || 0;
  const fallback =
    (par < 0 ? Math.abs(par) * 2 : par * -1) + (Number(row.player_rounds) * 2);
  const e = row.earned_points;
  if (e === null || e === undefined) return fallback;
  const n = Number(e);
  return Number.isFinite(n) ? n : fallback;
}

export type PlayerStatRow = {
  name: string;
  pts: number;
  rating: number | null;
  /** Nykyisen kisan erittely (players-rivi); vain aktiivisilla. */
  breakdown: PointsBreakdown | null;
  /** players.points — vertailuun laskettuun summaan */
  playerPointsStored: number | null;
  /** Kausi: pisteet per turnaus (max per kisa). */
  seasonByTournament?: Array<{ tournamentName: string; points: number }>;
};

function ratingForName(players: any[], name: string): number | null {
  const pl = players.find((p: any) => p.name === name);
  if (!pl) return null;
  const r = pl.official_rating;
  if (r === null || r === undefined || r === '') return null;
  const n = Number(r);
  return Number.isFinite(n) ? n : null;
}

function enrichRow(name: string, pts: number, players: any[]): PlayerStatRow {
  const pl = players.find((p: any) => p.name === name);
  const breakdown =
    pl?.is_active ? breakdownFromPlayerRow(pl) : null;
  return {
    name,
    pts,
    rating: ratingForName(players, name),
    breakdown,
    playerPointsStored: pl != null ? Number(pl.points) || 0 : null,
  };
}

function toRows(map: Map<string, number>, players: any[]): PlayerStatRow[] {
  return Array.from(map.entries())
    .map(([name, pts]) => enrichRow(name, pts, players))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, 'fi'));
}

/**
 * Tämä kisa: kaikki kentällä olevat (is_active) ja heidän tuloksensa players.points -kentästä.
 */
export function buildPlayerTournamentRows(players: any[]): PlayerStatRow[] {
  const byName = new Map<string, number>();
  players.forEach((p: any) => {
    if (!p?.is_active) return;
    const name = String(p.name || '').trim();
    if (!name) return;
    byName.set(name, Number(p.points) || 0);
  });
  return toRows(byName, players);
}

/**
 * Kausi: arkisto (max per turnaus per pelaaja) + nykyinen kisa: jokaisen aktiivisen pelaajan players.points.
 */
export function buildPlayerSeasonRows(
  history: any[],
  players: any[],
  activeTournamentName: string
): PlayerStatRow[] {
  const perTournament = new Map<string, Map<string, number>>();

  const addMax = (tournament: string, playerName: string, pts: number) => {
    if (!playerName?.trim()) return;
    if (!perTournament.has(tournament)) perTournament.set(tournament, new Map());
    const m = perTournament.get(tournament)!;
    m.set(playerName, Math.max(m.get(playerName) || 0, pts));
  };

  history.forEach((row: any) => {
    const t = row.tournament_name || 'Tuntematon turnaus';
    const name = row.player_name;
    if (!name) return;
    addMax(t, name, earnedPointsFromHistoryRow(row));
  });

  players.forEach((p: any) => {
    if (!p?.is_active) return;
    const name = String(p.name || '').trim();
    if (!name) return;
    addMax(activeTournamentName, name, Number(p.points) || 0);
  });

  const seasonTotals = new Map<string, number>();
  perTournament.forEach((playerMap) => {
    playerMap.forEach((pts, name) => {
      seasonTotals.set(name, (seasonTotals.get(name) || 0) + pts);
    });
  });

  /** Aktiiviset joilla ei vielä yhtään riviä (ei historiaa, 0 p) — näkyvät listassa. */
  players.forEach((p: any) => {
    if (!p?.is_active) return;
    const name = String(p.name || '').trim();
    if (!name) return;
    if (!seasonTotals.has(name)) seasonTotals.set(name, 0);
  });

  const seasonByPlayer = new Map<string, Array<{ tournamentName: string; points: number }>>();
  perTournament.forEach((playerMap, tournamentName) => {
    playerMap.forEach((pts, playerName) => {
      if (!seasonByPlayer.has(playerName)) seasonByPlayer.set(playerName, []);
      seasonByPlayer.get(playerName)!.push({ tournamentName, points: pts });
    });
  });
  seasonByPlayer.forEach((arr) => arr.sort((a, b) => a.tournamentName.localeCompare(b.tournamentName, 'fi')));

  return toRows(seasonTotals, players).map((row) => ({
    ...row,
    breakdown: null,
    seasonByTournament: seasonByPlayer.get(row.name) ?? [],
  }));
}
