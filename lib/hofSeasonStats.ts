import { historySeasonBucket } from './seasonSegment';

/**
 * Hot / HIO koko kaudelle: per arkisto-osa (bucket) pelaajan max (sama arvo usealla rivillä),
 * sitten summataan bucketit. Nykyinen kisa: aktiivisten pelaajien rivi kerran.
 */
function aggregatePerPlayerFromHistory(
  history: any[],
  field: 'hot_rounds' | 'hio_count'
): Map<string, number> {
  const maxInBucket = new Map<string, Map<string, number>>();
  for (const row of history) {
    const name = row.player_name;
    if (!name) continue;
    const raw = row[field];
    const v = raw != null && raw !== '' ? Number(raw) || 0 : 0;
    const b = historySeasonBucket(row);
    if (!maxInBucket.has(b)) maxInBucket.set(b, new Map());
    const m = maxInBucket.get(b)!;
    m.set(name, Math.max(m.get(name) || 0, v));
  }
  const season = new Map<string, number>();
  maxInBucket.forEach((m) => {
    m.forEach((val, name) => {
      season.set(name, (season.get(name) || 0) + val);
    });
  });
  return season;
}

export function seasonHotTotalsByPlayerName(history: any[], players: any[]): Map<string, number> {
  const season = aggregatePerPlayerFromHistory(history, 'hot_rounds');
  for (const p of players) {
    if (!p?.is_active) continue;
    const name = String(p.name || '').trim();
    if (!name) continue;
    const add = Number(p.hot_rounds) || 0;
    if (add === 0) continue;
    season.set(name, (season.get(name) || 0) + add);
  }
  return season;
}

export function seasonHioTotalsByPlayerName(history: any[], players: any[]): Map<string, number> {
  const season = aggregatePerPlayerFromHistory(history, 'hio_count');
  for (const p of players) {
    if (!p?.is_active) continue;
    const name = String(p.name || '').trim();
    if (!name) continue;
    const add = Number(p.hio_count) || 0;
    if (add === 0) continue;
    season.set(name, (season.get(name) || 0) + add);
  }
  return season;
}
