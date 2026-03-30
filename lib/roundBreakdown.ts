/**
 * Kierroskohtainen data (players.round_breakdown JSONB).
 */

export type RoundBreakdownStored = Array<{
  n: number;
  par: number;
  hot: number;
  hio: number;
}>;

function clampInt(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

/** Hyväksyy DB/JSON:n ja palauttaa normalisoidun listan tai null. */
export function normalizeRoundBreakdown(raw: unknown): RoundBreakdownStored | null {
  if (raw == null) return null;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: RoundBreakdownStored = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const n = clampInt(Number(o.n), NaN);
    if (!Number.isFinite(n) || n < 1) continue;
    const par = clampInt(Number(o.par), 0);
    const hot = Math.min(9, Math.max(0, clampInt(Number(o.hot ?? 0), 0)));
    const hio = Math.min(9, Math.max(0, clampInt(Number(o.hio ?? 0), 0)));
    out.push({ n, par, hot, hio });
  }
  if (out.length === 0) return null;
  out.sort((a, b) => a.n - b.n);
  return out;
}

export function aggregatesFromStoredRounds(rows: RoundBreakdownStored): {
  par: number;
  rounds: number;
  hot: number;
  hio: number;
} {
  let par = 0;
  let hot = 0;
  let hio = 0;
  for (const r of rows) {
    par += r.par;
    hot += r.hot;
    hio += r.hio;
  }
  return { par, rounds: rows.length, hot, hio };
}
