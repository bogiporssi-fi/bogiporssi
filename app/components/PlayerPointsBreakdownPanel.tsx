"use client";

import React from "react";
import { parPtsFromPar, type PointsBreakdown } from "../../lib/pointsBreakdown";

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
  const hasRounds = !!(roundsDetail && roundsDetail.length > 0);
  const fmtPts = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="w-full min-w-0">
      {hasRounds && (
        <div className="pm-player-breakdown-chips" aria-label="Kierrosten pisteet yhteenveto">
          {roundsDetail.map((rd, i) => (
            <span key={rd.n}>
              {i > 0 ? <span className="pm-player-breakdown-chips-sep">·</span> : null}
              <span className="pm-player-breakdown-chips-k">K{rd.n}</span>
              <span className="pm-player-breakdown-chips-v">{rd.runningTotalPts} p</span>
            </span>
          ))}
        </div>
      )}
      <details className={["pm-player-breakdown w-full min-w-0", className].filter(Boolean).join(" ")}>
        <summary className="pm-player-breakdown-summary">{summaryLabel}</summary>
        {hasRounds && (
          <div className="pm-player-breakdown-rounds">
            <div className="pm-player-breakdown-rounds-title">Kierrokset</div>
            <div className="pm-breakdown-table-wrap">
              <table className="pm-breakdown-table" aria-label="Kierroskohtaiset pisteet">
                <thead>
                  <tr>
                    <th scope="col">K</th>
                    <th scope="col">Kokonaistulos</th>
                    <th scope="col">Pisteet</th>
                    <th scope="col">Krs</th>
                    <th scope="col">Hot</th>
                    <th scope="col">HIO</th>
                    <th scope="col" title="Kumulatiivinen; ei sisällä sijoitusbonusta">
                      Yhteensä
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roundsDetail.map((rd) => (
                    <tr key={rd.n}>
                      <td className="pm-breakdown-col-k">K{rd.n}</td>
                      <td className="pm-breakdown-val tabular-nums">{fmtPts(rd.runningVsPar)}</td>
                      <td className="pm-breakdown-val">{fmtPts(parPtsFromPar(rd.runningVsPar))}</td>
                      <td className="pm-breakdown-val">{fmtPts(rd.roundsPts)}</td>
                      <td className="pm-breakdown-val">{fmtPts(rd.hotPts)}</td>
                      <td className="pm-breakdown-val">{fmtPts(rd.hioPts)}</td>
                      <td className="pm-breakdown-val pm-breakdown-val-total">{fmtPts(rd.runningTotalPts)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="pm-breakdown-tfoot-tr">
                    <td colSpan={5} className="pm-breakdown-tfoot-label">
                      Sijoitusbonus
                    </td>
                    <td className="pm-breakdown-val">{fmtPts(b.positionPts)}</td>
                    <td className="pm-breakdown-val pm-breakdown-val-total">{fmtPts(b.computedTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        <ul className="pm-player-breakdown-list">
          {hasRounds && (
            <li className="pm-player-breakdown-yhteenveto-label">Koko kisa</li>
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
            Hole-in-one ({b.hioCount} × 20):{" "}
            <span className="font-extrabold tabular-nums text-sky-200/90">{b.hioPts} p</span>
          </li>
          {!hasRounds && (
            <li>
              Sijoitusbonus:{" "}
              <span className="font-extrabold tabular-nums text-sky-200/90">{b.positionPts} p</span>
            </li>
          )}
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
