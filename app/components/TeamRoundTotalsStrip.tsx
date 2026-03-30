"use client";

import React from "react";
import { teamRoundTotalsFromPicks } from "../../lib/teamRoundTotals";

type Props = {
  picks: any[];
  /** Jos valinnoissa ei ole litteää players-objektia, anna pelaajalista */
  players?: any[];
  className?: string;
  /** Tulokset > Joukkueet -laajennus: isompi, selkeämpi */
  variant?: "default" | "roster";
};

/**
 * Näyttää joukkueen kierroskohtaiset yhteispisteet (kaikkien valittujen pelaajien summa / kierros).
 */
export default function TeamRoundTotalsStrip({ picks, players, className = "", variant = "default" }: Props) {
  const rows = teamRoundTotalsFromPicks(picks, players);
  if (rows.length === 0) return null;

  const isRoster = variant === "roster";

  return (
    <div
      className={[
        "pm-team-round-totals w-full min-w-0",
        isRoster ? "pm-team-round-totals--roster" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Joukkueen pisteet kierroksittain"
    >
      <span className="pm-team-round-totals-label">Joukkue yhteensä / kierros</span>
      <div className="pm-team-round-totals-chips">
        {rows.map((r, i) => (
          <span key={r.n}>
            {i > 0 ? <span className="pm-player-breakdown-chips-sep">·</span> : null}
            <span className="pm-player-breakdown-chips-k">K{r.n}</span>
            <span className="pm-player-breakdown-chips-v">{r.total} p</span>
          </span>
        ))}
      </div>
    </div>
  );
}
