/**
 * Fantasy-pisteiden kertymä (sama kaava kuin arkistoinnissa / page.tsx).
 */
import { normalizeRoundBreakdown, type RoundBreakdownStored } from "./roundBreakdown";

export type RoundDetailLine = {
  n: number;
  par: number;
  parPts: number;
  roundsPts: number;
  hot: number;
  hotPts: number;
  hio: number;
  hioPts: number;
  subtotal: number;
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

export function buildRoundDetailLines(stored: RoundBreakdownStored): RoundDetailLine[] {
  let cumulativePar = 0;
  return stored.map((r) => {
    let parPts = parPtsFromPar(r.par);
    // Kierroskohtainen erityissääntö:
    // jos pelaaja on ennen kierrosta miinuksen puolella ja kierros on plussaa,
    // plussa rankaistaan tuplana (esim. +2 => -4).
    if (r.par > 0 && cumulativePar < 0) {
      parPts = r.par * -2;
    }
    const roundsPts = 2;
    const hotPts = r.hot * 5;
    const hioPts = r.hio * 30;
    const subtotal = parPts + roundsPts + hotPts + hioPts;
    cumulativePar += r.par;
    return {
      n: r.n,
      par: r.par,
      parPts,
      roundsPts,
      hot: r.hot,
      hotPts,
      hio: r.hio,
      hioPts,
      subtotal,
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
  const hioPts = hioCount * 30;

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
