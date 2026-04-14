/**
 * Fantasy-pisteiden kertymä (sama kaava kuin arkistoinnissa / page.tsx).
 */
import { normalizeRoundBreakdown, type RoundBreakdownStored } from "./roundBreakdown";

export type RoundDetailLine = {
  n: number;
  /** Kierroksen par-ero (yksi kierros) */
  par: number;
  /** Kumulatiivinen par-ero tämän kierroksen jälkeen (kierrosten summa) */
  runningVsPar: number;
  parPts: number;
  roundsPts: number;
  hot: number;
  hotPts: number;
  hio: number;
  hioPts: number;
  /** Fantasy-pisteet tältä kierrokselta (marginaali; joukkueen kierrossummat) */
  roundMarginalPts: number;
  /** Fantasy-pisteet yhteensä tämän kierroksen jälkeen (ei sijoitusbonusta) */
  runningTotalPts: number;
};

export type PointsBreakdown = {
  /** Par-tulos (heitot suhteessa pariin) */
  parScore: number;
  /** Miinus-/plusheittojen pisteet */
  parPts: number;
  roundsPlayed: number;
  roundsPts: number;
  hotRounds: number;
  hotPts: number;
  hioCount: number;
  hioPts: number;
  positionPts: number;
  /** Laskettu summa (voi erota hieman players.points -kentästä) */
  computedTotal: number;
  /** Kierroskohtainen erittely, jos round_breakdown on tallennettu */
  roundsDetail?: RoundDetailLine[];
};

export function parPtsFromPar(par: number): number {
  return par < 0 ? Math.abs(par) * 2 : par * -1;
}

/**
 * Kierrosrivien par-pisteet = sama piecewise-sääntö kuin koko kisassa,
 * mutta näytetään marginaalina: f(kum_jälkeen) − f(kum_ennen), f = parPtsFromPar.
 * Summautuu aina f(lopullinen kumulatiivinen par) = par_score -riviin.
 */
export function buildRoundDetailLines(stored: RoundBreakdownStored): RoundDetailLine[] {
  let cumulativePar = 0;
  let cumHot = 0;
  let cumHio = 0;
  return stored.map((r, i) => {
    const beforeCum = cumulativePar;
    cumulativePar += r.par;
    const parPts = parPtsFromPar(cumulativePar) - parPtsFromPar(beforeCum);
    const roundsPts = 2;
    const hotPts = r.hot * 5;
    const hioPts = r.hio * 20;
    cumHot += r.hot;
    cumHio += r.hio;
    const roundMarginalPts = parPts + roundsPts + hotPts + hioPts;
    const runningTotalPts =
      parPtsFromPar(cumulativePar) + 2 * (i + 1) + 5 * cumHot + 20 * cumHio;
    return {
      n: r.n,
      par: r.par,
      runningVsPar: cumulativePar,
      parPts,
      roundsPts,
      hot: r.hot,
      hotPts,
      hio: r.hio,
      hioPts,
      roundMarginalPts,
      runningTotalPts,
    };
  });
}

export function breakdownFromPlayerRow(p: any): PointsBreakdown {
  const par = Number(p.par_score) || 0;
  const roundsPlayed = Number(p.rounds_played) || 0;
  const hotRounds = Number(p.hot_rounds) || 0;
  const hioCount = Number(p.hio_count) || 0;
  const positionPts = Number(p.position_bonus) || 0;

  const parPts = parPtsFromPar(par);
  const roundsPts = roundsPlayed * 2;
  const hotPts = hotRounds * 5;
  const hioPts = hioCount * 20;

  const computedTotal = parPts + roundsPts + hotPts + hioPts + positionPts;

  const rb = normalizeRoundBreakdown(p?.round_breakdown);
  const roundsDetail = rb ? buildRoundDetailLines(rb) : undefined;

  return {
    parScore: par,
    parPts,
    roundsPlayed,
    roundsPts,
    hotRounds,
    hotPts,
    hioCount,
    hioPts,
    positionPts,
    computedTotal,
    roundsDetail,
  };
}
