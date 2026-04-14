/**
 * Erottaa arkistoidut kierrokset toisistaan ja aktiivisesta kisasta,
 * jotta sama näyttönimi ei tuplaa pisteitä kausi-/HoF-laskennassa.
 */

export function historySeasonBucket(row: any): string {
  const seg = row?.season_segment;
  if (seg != null && Number.isFinite(Number(seg))) {
    return `seg:${Number(seg)}`;
  }
  const name = row?.tournament_name || 'Tuntematon turnaus';
  return `legacy:${name}`;
}

export function currentSeasonBucket(active: { season_segment?: number | null } | null | undefined): string {
  const seg = active?.season_segment;
  if (seg != null && Number.isFinite(Number(seg))) {
    return `seg:${Number(seg)}`;
  }
  return 'seg:1';
}

export function parseSegmentNumberFromBucket(bucket: string): number | null {
  if (!bucket.startsWith('seg:')) return null;
  const n = Number(bucket.slice(4));
  return Number.isFinite(n) ? n : null;
}

/** Ihmisluettava nimi bucketille (Historia / tooltip). */
export function buildHistoryBucketLabels(
  history: any[],
  activeTournament: { name?: string | null; season_segment?: number | null } | null | undefined
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const row of history) {
    const b = historySeasonBucket(row);
    if (!labels.has(b)) {
      labels.set(b, row.tournament_name || 'Tuntematon turnaus');
    }
  }
  labels.set(currentSeasonBucket(activeTournament), activeTournament?.name || 'Aktiivinen kisa');
  return labels;
}

export function sortSeasonBucketsDescending(buckets: string[], currentBucket: string): string[] {
  const unique = [...new Set(buckets)];
  const rest = unique.filter((b) => b !== currentBucket);
  rest.sort((a, b) => {
    const na = parseSegmentNumberFromBucket(a);
    const nb = parseSegmentNumberFromBucket(b);
    if (na != null && nb != null) return nb - na;
    if (na != null) return -1;
    if (nb != null) return 1;
    return a.localeCompare(b, 'fi');
  });
  if (unique.includes(currentBucket)) {
    return [currentBucket, ...rest];
  }
  return [currentBucket, ...unique];
}
