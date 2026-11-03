import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIN_PLAYER_PRICE,
  NORMAL_FIELD_PRICE_CURVE,
  NORMAL_FIELD_RATINGS_DESC,
  getFieldMarketPrices,
  getPlayerMarketPrice,
  getPriceFromRating,
} from './playerPrice.ts';

/** Heikompi kenttä (61 pelaajaa, rating 909–1041). Suhteelliset hinnat on lukittu. */
const WEAK_FIELD: Array<[string, number, number]> = [
  ['Sullivan Tipton', 1041, 299000],
  ['Cale Leiviska', 1038, 264400],
  ['Andrew Marwede', 1037, 254800],
  ['Paul Ulibarri', 1032, 249900],
  ['Matthew Orum', 1029, 239200],
  ['Kevin Kiefer III', 1025, 238600],
  ['Harper Thompson', 1024, 234300],
  ['Elijah Bickel', 1021, 231400],
  ['Kyle Holt', 1021, 231400],
  ['Ian Krajna', 1015, 229600],
  ['Robert Burridge', 1015, 229600],
  ['Sawyer Barlow', 1007, 228800],
  ['Maxime Tanghe', 1005, 226200],
  ['Max Stayton', 1005, 226200],
  ['Sam Eastridge', 1003, 223300],
  ['Gavin Cunningham', 999, 221000],
  ['Mitchell Privette', 998, 218900],
  ['Broden Barlow', 995, 215800],
  ['Colin Treinen', 994, 215800],
  ['Eli Swansen', 993, 212700],
  ['Weston Barfield', 993, 212700],
  ['Ben Holding', 989, 210600],
  ['Matthew Brown', 988, 208000],
  ['James Hopkins', 986, 208000],
  ['Colby Schefers', 986, 208000],
  ['Jackson Berry', 986, 208000],
  ['Zach Mullins', 983, 205400],
  ['Matthew Howell', 983, 205400],
  ['Kaleb Marsh', 981, 205300],
  ['Bubba Horton', 981, 205300],
  ['William Holt', 979, 200200],
  ['Eli Brown', 978, 197700],
  ['Woods McCue', 978, 197700],
  ['Peter Heidlauf', 976, 192400],
  ['Jake Reynolds', 976, 192400],
  ['Titus Holloway', 975, 190500],
  ['Elijah Pentz', 974, 189800],
  ['Jared Fuller', 973, 187200],
  ['Paul Roberts', 969, 187200],
  ['Tyler Gabrielse', 959, 187200],
  ['Blake Bailey', 958, 184600],
  ['Eli Clotfelter', 957, 182000],
  ['Peter Diede', 956, 181200],
  ['Dillon Whitten', 955, 176800],
  ['Alec Cease', 955, 176800],
  ['Micah McKerley', 955, 176800],
  ['Sam Contorno', 954, 171900],
  ['Paul Howell', 951, 171600],
  ['Linus Fullmer', 950, 168500],
  ['Blake Black', 949, 164600],
  ['Jacob Miller', 949, 164600],
  ['Thor Blankenship', 947, 163800],
  ['Tyler Ogden', 941, 161700],
  ['Ethan Holloway', 938, 157400],
  ['Derrick Bishop', 936, 147900],
  ['Carson Foster', 930, 143700],
  ['David Meade', 928, 143000],
  ['Dustin Kunze', 916, 135100],
  ['Nolan Evans', 915, 130800],
  ['Zachary Powell', 912, 130000],
  ['Charles Collins', 909, 130000],
];

function playersOf(rows: Array<[string, number, number] | [string, number]>) {
  return rows.map(([name, rating]) => ({ name, official_rating: rating }));
}

test('absoluuttinen kaava ja lattia eivät muutu', () => {
  assert.equal(MIN_PLAYER_PRICE, 130_000);
  assert.equal(getPriceFromRating(909), 130_000);
  assert.equal(getPriceFromRating(950), 130_000);
  assert.equal(getPriceFromRating(1000), 130_000);
  assert.equal(getPriceFromRating(1001), 132_600);
  assert.equal(getPriceFromRating(1041), 236_600);
  assert.equal(getPriceFromRating(1060), 286_000);
  assert.equal(getPlayerMarketPrice({ name: 'Gannon Buhr', official_rating: 1060 }), 299_000);
  assert.equal(getPlayerMarketPrice({ name: '  gannon   buhr ', official_rating: 900 }), 299_000);
  assert.equal(getPlayerMarketPrice({ name: 'HeimBuhrg', official_rating: 1000 }), 285_000);
  assert.equal(getPlayerMarketPrice({ name: 'Muu pelaaja', official_rating: '1041' }), 236_600);
  assert.equal(getPlayerMarketPrice({ name: 'Muu', official_rating: null }), 130_000);
});

test('normaalin kentän hintakäyrä vastaa kaavaa ja Gannonin poikkeusta', () => {
  assert.equal(NORMAL_FIELD_RATINGS_DESC.length, 100);
  assert.equal(NORMAL_FIELD_PRICE_CURVE.length, 100);
  assert.equal(NORMAL_FIELD_PRICE_CURVE[0], 299_000);
  assert.equal(NORMAL_FIELD_PRICE_CURVE.at(-1), 130_000);
  for (let i = 0; i < NORMAL_FIELD_RATINGS_DESC.length; i += 1) {
    const expected = getPlayerMarketPrice({
      name: i === 0 ? 'Gannon Buhr' : `Pelaaja ${i}`,
      official_rating: NORMAL_FIELD_RATINGS_DESC[i],
    });
    assert.equal(NORMAL_FIELD_PRICE_CURVE[i], expected, `indeksi ${i}`);
    if (i > 0) assert.ok(NORMAL_FIELD_PRICE_CURVE[i - 1] >= NORMAL_FIELD_PRICE_CURVE[i]);
  }
  assert.equal(NORMAL_FIELD_PRICE_CURVE.filter((price) => price === 130_000).length, 4);
});

test('suhteellinen tila normaalilla kentällä palauttaa samat hinnat kuin kaava', () => {
  const field = NORMAL_FIELD_RATINGS_DESC.map((rating, index) => ({
    name: index === 0 ? 'Gannon Buhr' : `Pelaaja ${index}`,
    official_rating: rating,
  }));
  const relative = getFieldMarketPrices(field, 'relative');
  const absolute = getFieldMarketPrices(field, 'absolute');
  assert.deepEqual(
    relative.map((row) => row.price),
    absolute.map((row) => row.price)
  );
});

test('heikomman kentän suhteelliset hinnat ja joukkueen tasapaino', () => {
  const shuffled = [...WEAK_FIELD].reverse();
  const priced = getFieldMarketPrices(playersOf(shuffled), 'relative');
  const byName = new Map(priced.map((row) => [row.name, row.price]));
  for (const [name, , expected] of WEAK_FIELD) {
    assert.equal(byName.get(name), expected, name);
  }

  const ordered = [...priced].sort((a, b) => b.rating - a.rating || (a.name ?? '').localeCompare(b.name ?? ''));
  for (let i = 1; i < ordered.length; i += 1) {
    assert.ok(ordered[i - 1].price >= ordered[i].price);
    if (ordered[i - 1].rating === ordered[i].rating) {
      assert.equal(ordered[i - 1].price, ordered[i].price);
    }
  }

  const prices = priced.map((row) => row.price).sort((a, b) => b - a);
  const cheapest = [...prices].sort((a, b) => a - b);
  const budget = 1_000_000;
  const top5 = prices.slice(0, 5).reduce((sum, price) => sum + price, 0);
  const top3 = prices.slice(0, 3).reduce((sum, price) => sum + price, 0);
  const top2 = prices.slice(0, 2).reduce((sum, price) => sum + price, 0);
  assert.equal(prices.filter((price) => price === MIN_PLAYER_PRICE).length, 2);
  assert.equal(top5, 1_307_300);
  assert.ok(top2 + cheapest[0] + cheapest[1] + cheapest[2] <= budget);
  assert.ok(top3 + cheapest[0] + cheapest[1] > budget);
  assert.equal(budget / top5 > 0.74 && budget / top5 < 0.8, true);
});

test('absoluuttinen tila heikolla kentällä pitää 130 000 € lattian', () => {
  const priced = getFieldMarketPrices(playersOf(WEAK_FIELD), 'absolute');
  assert.equal(priced.filter((row) => row.price === MIN_PLAYER_PRICE).length, 46);
  const sullivan = priced.find((row) => row.name === 'Sullivan Tipton');
  assert.equal(sullivan?.price, 236_600);
  assert.equal(getFieldMarketPrices(playersOf(WEAK_FIELD), undefined)[0]?.price, priced[0]?.price);
  assert.equal(getFieldMarketPrices(playersOf(WEAK_FIELD), 'percentile')[2]?.price, priced[2]?.price);
});

test('nimikohtainen poikkeushinta voittaa suhteellisen käyrän', () => {
  const field = [
    { name: 'Alice', official_rating: 1040 },
    { name: 'Gannon Buhr', official_rating: 910 },
    { name: 'HeimBuhrg', official_rating: 1000 },
    { name: 'Bob', official_rating: 900 },
  ];
  const priced = getFieldMarketPrices(field, 'relative');
  const priceOf = (name: string) => priced.find((row) => row.name === name)?.price;
  assert.equal(priceOf('Gannon Buhr'), 299_000);
  assert.equal(priceOf('HeimBuhrg'), 285_000);
  assert.equal(priceOf('Alice'), 299_000);
  assert.equal(priceOf('Bob'), 130_000);
  assert.notEqual(priceOf('Gannon Buhr'), getPlayerMarketPrice({ name: 'Muu', official_rating: 910 }));
});

test('yhden ja kahden pelaajan kenttä osuu käyrän päihin', () => {
  assert.equal(getFieldMarketPrices([{ name: 'Aino', official_rating: 980 }], 'relative')[0]?.price, 299_000);
  const pair = getFieldMarketPrices(
    [
      { name: 'Halpa', official_rating: 910 },
      { name: 'Kallis', official_rating: 1030 },
    ],
    'relative'
  );
  assert.equal(pair.find((row) => row.name === 'Kallis')?.price, 299_000);
  assert.equal(pair.find((row) => row.name === 'Halpa')?.price, 130_000);
  assert.deepEqual(getFieldMarketPrices([], 'relative'), []);
});
