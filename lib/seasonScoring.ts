import { historySeasonBucket } from './seasonSegment';

export const SEASON_DROP_COUNT = 3;
export const TOURNAMENT_WIN_BONUS = 10;
export const TEAM_LEGACY_PREFIX = 'legacy:';

export type SeasonTournamentLine = {
  bucket: string;
  tournamentName: string;
  points: number;
  winBonus: number;
  total: number;
  missed: boolean;
  dropped: boolean;
  retainedWinBonus: boolean;
  /** Aktiivinen kisa — ei pudotu eikä saa voittobonusta ennen arkistointia. */
  inProgress?: boolean;
};

export type SeasonScoreResult = {
  allTotal: number;
  adjustedTotal: number;
  tournaments: SeasonTournamentLine[];
};

export type TeamSeasonBoardEntry = {
  uid?: string;
  name: string;
  pts: number;
  ptsAll: number;
  tournamentLines: SeasonTournamentLine[];
};

export function teamKeyFromHistoryRow(row: any): string {
  const uid = row.user_id as string | undefined;
  if (uid && typeof uid === 'string') return uid;
  return `${TEAM_LEGACY_PREFIX}${row.team_name || 'Nimetön tiimi'}`;
}

/** Sama fallback kuin Historia-näkymän joukkuetuloksissa. */
export function earnedPointsFromArchiveRow(row: any): number {
  const e = row?.earned_points;
  if (e !== null && e !== undefined && e !== '') {
    const n = Number(e);
    if (Number.isFinite(n)) return n;
  }
  const par = Number(row.player_score) || 0;
  return (par < 0 ? Math.abs(par) * 2 : par * -1) + (Number(row.player_rounds) || 0) * 2;
}

function teamNameFromHistoryRow(row: any): string | null {
  const name = String(row?.team_name || '').trim();
  return name || null;
}

export function seasonDropCount(tournamentCount: number): number {
  return Math.min(SEASON_DROP_COUNT, Math.max(0, tournamentCount - 1));
}

export function scoreTeamSeasonFromTournaments(
  tournamentOrder: string[],
  bucketLabels: Map<string, string>,
  pointsByBucket: Map<string, number>,
  participatedBuckets: Set<string>,
  winnersByBucket: Map<string, Set<string>>,
  winnerLookupKey: string,
  currentBucket: string | null
): SeasonScoreResult {
  const tournaments: SeasonTournamentLine[] = tournamentOrder.map((bucket) => {
    const inProgress = currentBucket != null && bucket === currentBucket;
    const participated = participatedBuckets.has(bucket);
    const points = participated ? pointsByBucket.get(bucket) ?? 0 : 0;
    const missed = !participated && !inProgress;
    const isWinner = winnersByBucket.get(bucket)?.has(winnerLookupKey) ?? false;
    const winBonus = isWinner && !inProgress ? TOURNAMENT_WIN_BONUS : 0;
    return {
      bucket,
      tournamentName: bucketLabels.get(bucket) || bucket,
      points,
      winBonus,
      total: points + winBonus,
      missed,
      dropped: false,
      retainedWinBonus: false,
      inProgress,
    };
  });

  const allTotal = tournaments.reduce((sum, row) => sum + row.total, 0);
  const archived = tournaments.filter((row) => !row.inProgress);
  const dropCount = seasonDropCount(archived.length);
  const sortedForDrop = [...archived].sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    return a.bucket.localeCompare(b.bucket, 'fi');
  });
  const droppedBuckets = new Set(sortedForDrop.slice(0, dropCount).map((row) => row.bucket));

  let adjustedTotal = 0;
  for (const row of tournaments) {
    if (row.inProgress) {
      adjustedTotal += row.points;
    } else if (droppedBuckets.has(row.bucket)) {
      row.dropped = true;
      if (row.winBonus > 0) {
        row.retainedWinBonus = true;
        adjustedTotal += row.winBonus;
      }
    } else {
      adjustedTotal += row.total;
    }
  }

  return { allTotal, adjustedTotal, tournaments };
}

export function computeTournamentWinnersByBucket(opts: {
  history: any[];
  picks: any[];
  currentBucket: string;
  getPickPoints: (pick: any) => number;
  getTeamNameForPick: (pick: any) => string | null;
  isFieldSnapshot: (row: any) => boolean;
}): Map<string, Set<string>> {
  const { history, picks, currentBucket, getPickPoints, getTeamNameForPick, isFieldSnapshot } = opts;
  const totalsByBucket = new Map<string, Map<string, number>>();

  const add = (bucket: string, teamName: string, pts: number) => {
    if (!totalsByBucket.has(bucket)) totalsByBucket.set(bucket, new Map());
    const teamMap = totalsByBucket.get(bucket)!;
    teamMap.set(teamName, (teamMap.get(teamName) || 0) + pts);
  };

  for (const row of history) {
    if (isFieldSnapshot(row)) continue;
    const teamName = teamNameFromHistoryRow(row);
    if (!teamName) continue;
    add(historySeasonBucket(row), teamName, earnedPointsFromArchiveRow(row));
  }

  for (const pick of picks) {
    const teamName = getTeamNameForPick(pick);
    if (!teamName) continue;
    add(currentBucket, teamName, getPickPoints(pick));
  }

  const winners = new Map<string, Set<string>>();
  totalsByBucket.forEach((teamTotals, bucket) => {
    let max = -Infinity;
    for (const pts of teamTotals.values()) {
      if (pts > max) max = pts;
    }
    if (!Number.isFinite(max)) return;
    const winningKeys = new Set<string>();
    teamTotals.forEach((pts, key) => {
      if (pts === max) winningKeys.add(key);
    });
    winners.set(bucket, winningKeys);
  });

  return winners;
}

export function buildTeamSeasonBoard(opts: {
  history: any[];
  picks: any[];
  bucketLabels: Map<string, string>;
  tournamentOrder: string[];
  currentBucket: string;
  getPickPoints: (pick: any) => number;
  getTeamNameForPick: (pick: any) => string | null;
  isFieldSnapshot: (row: any) => boolean;
  getTeamDisplayName: (teamKey: string) => string;
  getWinnerLookupKey: (teamKey: string) => string;
}): TeamSeasonBoardEntry[] {
  const {
    history,
    picks,
    bucketLabels,
    tournamentOrder,
    currentBucket,
    getPickPoints,
    getTeamNameForPick,
    isFieldSnapshot,
    getTeamDisplayName,
    getWinnerLookupKey,
  } = opts;

  const pointsByTeamAndBucket = new Map<string, Map<string, number>>();
  const participatedByTeam = new Map<string, Set<string>>();
  const teamKeys = new Set<string>();

  const markParticipation = (teamKey: string, bucket: string) => {
    teamKeys.add(teamKey);
    if (!participatedByTeam.has(teamKey)) participatedByTeam.set(teamKey, new Set());
    participatedByTeam.get(teamKey)!.add(bucket);
  };

  const addPoints = (teamKey: string, bucket: string, pts: number) => {
    markParticipation(teamKey, bucket);
    if (!pointsByTeamAndBucket.has(teamKey)) pointsByTeamAndBucket.set(teamKey, new Map());
    const bucketMap = pointsByTeamAndBucket.get(teamKey)!;
    bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + pts);
  };

  for (const row of history) {
    if (isFieldSnapshot(row)) continue;
    addPoints(teamKeyFromHistoryRow(row), historySeasonBucket(row), Number(row.earned_points) || 0);
  }

  for (const pick of picks) {
    const uid = pick.user_id;
    if (!uid) continue;
    addPoints(String(uid), currentBucket, getPickPoints(pick));
  }

  const winnersByBucket = computeTournamentWinnersByBucket({
    history,
    picks,
    currentBucket,
    getPickPoints,
    getTeamNameForPick,
    isFieldSnapshot,
  });

  return [...teamKeys]
    .map((teamKey) => {
      const isLegacy = teamKey.startsWith(TEAM_LEGACY_PREFIX);
      const score = scoreTeamSeasonFromTournaments(
        tournamentOrder,
        bucketLabels,
        pointsByTeamAndBucket.get(teamKey) || new Map(),
        participatedByTeam.get(teamKey) || new Set(),
        winnersByBucket,
        getWinnerLookupKey(teamKey),
        currentBucket
      );

      return {
        uid: isLegacy ? undefined : teamKey,
        name: getTeamDisplayName(teamKey),
        pts: score.adjustedTotal,
        ptsAll: score.allTotal,
        tournamentLines: score.tournaments,
      };
    })
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, 'fi'));
}
