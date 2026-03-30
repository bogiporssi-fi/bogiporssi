"use client";

import React from "react";
import type { PointsBreakdown } from "../../lib/pointsBreakdown";

type Props = {
  breakdown: PointsBreakdown;
  storedPoints: number | null;
  /** Oletus Tulokset / oma joukkue */
  summaryLabel?: string;
  className?: string;
};

export default function PlayerPointsBreakdownPanel({
  breakdown,
  storedPoints,
  summaryLabel = "Piste-erittely (tämä kisa)",
  className = "",
}: Props) {
  const b = breakdown;
  const mismatch =
    storedPoints != null && Math.abs(b.computedTotal - storedPoints) > 0.5;
  const roundsDetail = b.roundsDetail;

  return (
    <div className="w-full min-w-0">
      {roundsDetail && roundsDetail.length > 0 && (
        <div className="pm-player-breakdown-chips" aria-label="Kierrosten pisteet yhteenveto">
          {roundsDetail.map((rd, i) => (
            <span key={rd.n}>
              {i > 0 ? <span className="pm-player-breakdown-chips-sep">·</span> : null}
              <span className="pm-player-breakdown-chips-k">K{rd.n}</span>
              <span className="pm-player-breakdown-chips-v">{rd.subtotal} p</span>
            </span>
          ))}
        </div>
      )}
      <details className={["pm-player-breakdown w-full min-w-0", className].filter(Boolean).join(" ")}>
      <summary className="pm-player-breakdown-summary">{summaryLabel}</summary>
      {roundsDetail && roundsDetail.length > 0 && (
        <div className="pm-player-breakdown-rounds">
          <div className="pm-player-breakdown-rounds-title">Kierrokset</div>
          {roundsDetail.map((rd) => (
            <div key={rd.n} className="pm-player-breakdown-round-block">
              <div className="pm-player-breakdown-round-label">Kierros {rd.n}</div>
              <ul className="pm-player-breakdown-sublist">
                <li>
                  Miinus-/plusheitot (par {rd.par}):{" "}
                  <span className="font-extrabold tabular-nums text-sky-200/90">{rd.parPts} p</span>
                </li>
                <li>
                  Pelattu kierros (1 × 2):{" "}
                  <span className="font-extrabold tabular-nums text-sky-200/90">{rd.roundsPts} p</span>
                </li>
                {rd.hot > 0 && (
                  <li>
                    Hot ({rd.hot} × 5):{" "}
                    <span className="font-extrabold tabular-nums text-sky-200/90">{rd.hotPts} p</span>
                  </li>
                )}
                {rd.hio > 0 && (
                  <li>
                    Hole-in-one ({rd.hio} × 30):{" "}
                    <span className="font-extrabold tabular-nums text-sky-200/90">{rd.hioPts} p</span>
                  </li>
                )}
                <li className="pm-player-breakdown-round-subtotal">
                  Kierros yhteensä:{" "}
                  <span className="font-extrabold tabular-nums text-amber-200/90">{rd.subtotal} p</span>
                </li>
              </ul>
            </div>
          ))}
        </div>
      )}
      <ul className="pm-player-breakdown-list">
        {roundsDetail && roundsDetail.length > 0 && (
          <li className="pm-player-breakdown-yhteenveto-label">Koko kisa (yhteenveto)</li>
        )}
        <li>
          Miinus-/plusheitot (par {b.parScore}):{" "}
          <span className="font-extrabold tabular-nums text-sky-200/90">{b.parPts} p</span>
        </li>
        <li>
          Pelatut kierrokset ({b.roundsPlayed} × 2):{" "}
          <span className="font-extrabold tabular-nums text-sky-200/90">{b.roundsPts} p</span>
        </li>
        <li>
          Hot round ({b.hotRounds} × 5):{" "}
          <span className="font-extrabold tabular-nums text-sky-200/90">{b.hotPts} p</span>
        </li>
        <li>
          Hole-in-one ({b.hioCount} × 30):{" "}
          <span className="font-extrabold tabular-nums text-sky-200/90">{b.hioPts} p</span>
        </li>
        <li>
          Sijoitusbonus:{" "}
          <span className="font-extrabold tabular-nums text-sky-200/90">{b.positionPts} p</span>
        </li>
        <li className="pm-player-breakdown-total">
          Laskettu yhteensä:{" "}
          <span className="font-extrabold tabular-nums text-amber-200/95">{b.computedTotal} p</span>
        </li>
      </ul>
      {mismatch && storedPoints != null && (
        <p className="pm-player-breakdown-note">
          Tallennettu pistesaldo: {storedPoints} p (jos ero, admin-tuonti voi olla päivittämättä kaikkia kenttiä.)
        </p>
      )}
    </details>
    </div>
  );
}
