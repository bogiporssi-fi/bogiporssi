export const MIN_PLAYER_PRICE = 130_000;

/**
 * Normaalin kentän ratingit kalleimmasta halvimpaan (100 pelaajaa).
 * Käyrän kärki on Gannon Buhr: kaava antaisi 286 000 €, kiinteä hinta on 299 000 €.
 * Loput hinnat tulevat suoraan rating-kaavasta. Sama rating jakaa saman hinnan,
 * joten käyrä on tasainen niillä kohdilla.
 */
export const NORMAL_FIELD_RATINGS_DESC: readonly number[] = [
  1060, 1053, 1051, 1048, 1048, 1046, 1042, 1042, 1042, 1041, 1040, 1040, 1039, 1039, 1039, 1039, 1038,
  1038, 1038, 1038, 1037, 1037, 1037, 1036, 1035, 1035, 1035, 1033, 1033, 1033, 1033, 1032, 1032, 1031,
  1031, 1031, 1030, 1030, 1030, 1030, 1030, 1030, 1029, 1029, 1029, 1029, 1029, 1029, 1028, 1027, 1027,
  1027, 1026, 1025, 1025, 1024, 1024, 1024, 1023, 1023, 1023, 1022, 1022, 1022, 1022, 1022, 1021, 1020,
  1020, 1020, 1019, 1018, 1018, 1018, 1017, 1017, 1016, 1016, 1016, 1015, 1014, 1014, 1013, 1013, 1013,
  1013, 1012, 1011, 1010, 1007, 1006, 1005, 1005, 1005, 1002, 1001, 1000, 999, 992, 955,
];

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
  // DGPT Doubles 2026: pari on oma markkinakohteensa.
  heimbuhrg: 285_000,
};

export function getFixedPlayerMarketPrice(name: string | null | undefined): number | undefined {
  const key = name != null ? normPlayerNameKey(String(name)) : '';
  const fixed = key ? FIXED_PLAYER_MARKET_PRICES[key] : undefined;
  if (fixed == null) return undefined;
  return Math.max(MIN_PLAYER_PRICE, fixed);
}

export type MarketPlayer = {
  name?: string | null;
  official_rating?: number | string | null;
};

export function coerceOfficialRating(value: unknown): number {
  const rating = Number(value);
  return Number.isFinite(rating) ? rating : 950;
}

export function marketPriceKey(name: string | null | undefined, rating: number): string {
  return `${normPlayerNameKey(name ?? '')}|${rating}`;
}

export function getPlayerMarketPrice(player: MarketPlayer): number {
  const fixed = getFixedPlayerMarketPrice(player.name);
  if (fixed != null) return fixed;
  return getPriceFromRating(coerceOfficialRating(player.official_rating));
}

/** Normaalin kentän markkinahinnat kalleimmasta halvimpaan, poikkeushinnat mukana. */
export const NORMAL_FIELD_PRICE_CURVE: readonly number[] = NORMAL_FIELD_RATINGS_DESC.map((rating, index) =>
  getPlayerMarketPrice({
    name: index === 0 ? 'Gannon Buhr' : undefined,
    official_rating: rating,
  })
);

export type FieldMarketPrice = {
  name: string | null;
  rating: number;
  price: number;
};

/**
 * Suhteellinen hinta: pelaajan sijan persentiili tässä kentässä luetaan
 * normaalin kentän hintakäyrältä. Sama rating saa saman hinnan (tasapelin
 * keskikohta). Tulos pyöristetään lähimpään 100 €:oon, tasan x50 € ylöspäin.
 * Nimikohtainen poikkeushinta voittaa käyrän.
 */
function relativeCurvePrice(rankTwice: number, fieldSize: number): number {
  const curve = NORMAL_FIELD_PRICE_CURVE;
  const last = curve.length - 1;
  if (fieldSize <= 1 || last <= 0) return curve[0] ?? MIN_PLAYER_PRICE;
  const denom = 2 * (fieldSize - 1);
  const numer = rankTwice * last;
  const lo = Math.floor(numer / denom);
  const rem = numer % denom;
  const hi = Math.min(last, lo + 1);
  const priceNum = curve[lo] * (denom - rem) + curve[hi] * rem;
  const scale = denom * 100;
  const roundedHundreds = Math.floor((2 * priceNum + scale) / (2 * scale));
  return Math.max(MIN_PLAYER_PRICE, roundedHundreds * 100);
}

function absoluteFieldPrices(players: MarketPlayer[]): FieldMarketPrice[] {
  return players.map((player) => {
    const rating = coerceOfficialRating(player.official_rating);
    return {
      name: player.name ?? null,
      rating,
      price: getPlayerMarketPrice({ name: player.name, official_rating: rating }),
    };
  });
}

function relativeFieldPrices(players: MarketPlayer[]): FieldMarketPrice[] {
  const indexed = players.map((player, index) => ({
    index,
    name: player.name ?? null,
    rating: coerceOfficialRating(player.official_rating),
    fixed: getFixedPlayerMarketPrice(player.name),
  }));
  const sorted = [...indexed].sort((a, b) => b.rating - a.rating);
  const prices = new Array<number>(indexed.length);
  const fieldSize = sorted.length;
  let start = 0;
  while (start < fieldSize) {
    let end = start + 1;
    while (end < fieldSize && sorted[end].rating === sorted[start].rating) end += 1;
    const curvePrice = relativeCurvePrice(start + (end - 1), fieldSize);
    for (let cursor = start; cursor < end; cursor += 1) {
      const row = sorted[cursor];
      prices[row.index] = row.fixed ?? curvePrice;
    }
    start = end;
  }
  return indexed.map((row) => ({
    name: row.name,
    rating: row.rating,
    price: prices[row.index],
  }));
}

/**
 * absolute (ja kaikki muu kuin täsmälleen 'relative') = nykyinen rating-kaava.
 * Puuttuva sarake ja vanhat kisat osuvat tähän haaraan.
 */
export function getFieldMarketPrices(
  players: MarketPlayer[],
  mode: string | null | undefined
): FieldMarketPrice[] {
  if (mode !== 'relative') return absoluteFieldPrices(players);
  return relativeFieldPrices(players);
}

export function fieldMarketPriceMap(
  players: MarketPlayer[],
  mode: string | null | undefined
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of getFieldMarketPrices(players, mode)) {
    map.set(marketPriceKey(row.name, row.rating), row.price);
  }
  return map;
}
