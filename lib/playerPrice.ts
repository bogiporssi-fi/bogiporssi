export const MIN_PLAYER_PRICE = 130_000;

/** HINNOITTELUKAAVA: max(130 000, (Rating - 950) * 2600) */
export function getPriceFromRating(rating: number): number {
  const diff = rating - 950;
  const computed = diff > 0 ? diff * 2600 : 0;
  return Math.max(MIN_PLAYER_PRICE, computed);
}

function normPlayerNameKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Kiinteät markkinahinnat (nimi normalisoitu). Lisää tarvittaessa. */
const FIXED_PLAYER_MARKET_PRICES: Record<string, number> = {
  'gannon buhr': 299_000,
};

export function getPlayerMarketPrice(player: {
  name?: string | null;
  official_rating?: number | string | null;
}): number {
  const key = player.name != null ? normPlayerNameKey(String(player.name)) : '';
  const fixed = key ? FIXED_PLAYER_MARKET_PRICES[key] : undefined;
  if (fixed != null) return Math.max(MIN_PLAYER_PRICE, fixed);
  const r = Number(player.official_rating);
  return getPriceFromRating(Number.isFinite(r) ? r : 950);
}
