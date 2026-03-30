import { breakdownFromPlayerRow } from "./pointsBreakdown";

/**
 * Joukkueen fantasy-pisteet kierroksittain: summa pelaajien kierroskohtaisista subtotaleista
 * (round_breakdown / roundsDetail). Ei sisällä sijoitusbonusta (turnaustason kenttä).
 */
export function teamRoundTotalsFromPicks(picks: any[], players?: any[]): { n: number; total: number }[] {
  const map = new Map<number, number>();
  for (const pick of picks) {
    const pl =
      pick.players ?? (players ? players.find((p: any) => p.id === pick.player_id) : null);
    if (!pl) continue;
    const b = breakdownFromPlayerRow(pl);
    if (!b.roundsDetail?.length) continue;
    for (const rd of b.roundsDetail) {
      map.set(rd.n, (map.get(rd.n) ?? 0) + rd.subtotal);
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, total]) => ({ n, total }));
}
