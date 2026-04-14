/**
 * Pisteet valintariviltä: players.points on totuus; earned_points vain fallback
 * (vanha denormalisoitu arvo ei saa näyttää väärää jos pelaaja on nollattu).
 */
export function getPickPointsFromPick(pick: any): number {
  const live =
    pick?.players?.points ??
    (pick?.points !== null && pick?.points !== undefined ? pick.points : undefined);
  if (live !== null && live !== undefined) {
    const n = Number(live);
    if (Number.isFinite(n)) return n;
  }
  if (pick?.earned_points !== null && pick?.earned_points !== undefined) {
    return Number(pick.earned_points) || 0;
  }
  return 0;
}
