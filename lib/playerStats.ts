import { breakdownFromPlayerRow, type PointsBreakdown } from './pointsBreakdown';
import { currentSeasonBucket, historySeasonBucket, parseSegmentNumberFromBucket } from './seasonSegment';

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

/**
 * Arkistorivi: fantasy ilman sijoitusbonusta (sama kaava kuin archiveEarnedPointsFromPlayer ilman position_bonus).
 */
export function statsOnlyPointsFromHistoryRow(row: any): number {
  const par = Number(row.player_score) || 0;
  return (
    (par < 0 ? Math.abs(par) * 2 : par * -1) +
    (Number(row.player_rounds) || 0) * 2 +
    (Number(row.hot_rounds) || 0) * 5 +
    (Number(row.hio_count) || 0) * 20
  );
}

/**
 * Sijoitusbonus arkistoriviltä: `earned_points` − tilastopisteet.
 * Arkistossa ei ole erillistä position_bonus -kenttää; tämä johtaa bonuksen tallennetusta kokonaispistemäärästä.
 * Jos `earned_points` puuttuu, palautetaan null (ei voi päätellä luotettavasti).
 */
export function positionBonusFromHistoryRow(row: any): number | null {
  const e = row?.earned_points;
  if (e === null || e === undefined || e === '') return null;
  const total = Number(e);
  if (!Number.isFinite(total)) return null;
  return total - statsOnlyPointsFromHistoryRow(row);
}

/**
 * Johdettu fantasy-sijoitus yhdessä arkistoidussa kisassa (bucket = historySeasonBucket).
 * Vertailu: max fantasy-pisteet per pelaajan nimi samassa bucketissa; sija = 1 + määrä pelaajia joilla enemmän pisteitä (tasapeli = sama sija).
 */
export function fantasyPlacementInBucket(
  allHistory: any[],
  bucketRow: any,
  playerName: string
): { rank: number; field: number } | null {
  const nameKey = String(playerName || '').trim();
  if (!nameKey || !bucketRow) return null;
  const bucket = historySeasonBucket(bucketRow);
  const inBucket = (allHistory || []).filter((r) => historySeasonBucket(r) === bucket);
  const byName = new Map<string, number>();
  for (const r of inBucket) {
    const n = String(r?.player_name || '').trim();
    if (!n) continue;
    const pts = earnedPointsFromHistoryRow(r);
    const prev = byName.get(n);
    byName.set(n, prev === undefined ? pts : Math.max(prev, pts));
  }
  const playerPts = byName.get(nameKey);
  if (playerPts === undefined) return null;
  let higher = 0;
  for (const [, pts] of byName) {
    if (pts > playerPts) higher++;
  }
  return { rank: higher + 1, field: byName.size };
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

export type BuildPlayerSeasonOpts = {
  name: string;
  seasonSegment: number;
};

/**
 * Kausi: arkisto (max per osio per pelaaja) + nykyinen osio: aktiivisten pelaajien players.points.
 * Sisäinen avain = seasonSegment-bucket (ei pelkkä näyttönimi).
 */
export function buildPlayerSeasonRows(
  history: any[],
  players: any[],
  opts: BuildPlayerSeasonOpts
): PlayerStatRow[] {
  const perTournament = new Map<string, Map<string, number>>();
  const bucketLabels = new Map<string, string>();

  /** Paras tulos / bucket / pelaaja (useita rivejä). Ei saa käyttää || 0: miinukset katoaisivat Math.max(0, -5). */
  const addMax = (bucket: string, playerName: string, pts: number) => {
    if (!playerName?.trim()) return;
    if (!perTournament.has(bucket)) perTournament.set(bucket, new Map());
    const m = perTournament.get(bucket)!;
    const prev = m.get(playerName);
    m.set(playerName, prev === undefined ? pts : Math.max(prev, pts));
  };

  history.forEach((row: any) => {
    const b = historySeasonBucket(row);
    if (!bucketLabels.has(b)) {
      bucketLabels.set(b, row.tournament_name || 'Tuntematon turnaus');
    }
    const name = row.player_name;
    if (!name) return;
    addMax(b, name, earnedPointsFromHistoryRow(row));
  });

  const activeTournamentLike = { season_segment: opts.seasonSegment };
  const currentB = currentSeasonBucket(activeTournamentLike);
  bucketLabels.set(currentB, opts.name);

  players.forEach((p: any) => {
    if (!p?.is_active) return;
    const name = String(p.name || '').trim();
    if (!name) return;
    addMax(currentB, name, Number(p.points) || 0);
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

  type Line = { bucket: string; tournamentName: string; points: number };
  const seasonByPlayer = new Map<string, Line[]>();
  perTournament.forEach((playerMap, bucket) => {
    const label = bucketLabels.get(bucket) || bucket;
    playerMap.forEach((pts, playerName) => {
      if (!seasonByPlayer.has(playerName)) seasonByPlayer.set(playerName, []);
      seasonByPlayer.get(playerName)!.push({ bucket, tournamentName: label, points: pts });
    });
  });
  const sortBuckets = (a: string, b: string) => {
    const na = parseSegmentNumberFromBucket(a);
    const nb = parseSegmentNumberFromBucket(b);
    if (na != null && nb != null) return nb - na;
    if (na != null) return -1;
    if (nb != null) return 1;
    return a.localeCompare(b, 'fi');
  };
  seasonByPlayer.forEach((arr) => {
    arr.sort((x, y) => sortBuckets(x.bucket, y.bucket));
  });

  return toRows(seasonTotals, players).map((row) => ({
    ...row,
    breakdown: null,
    seasonByTournament: (seasonByPlayer.get(row.name) ?? []).map(({ tournamentName, points }) => ({
      tournamentName,
      points,
    })),
  }));
}
