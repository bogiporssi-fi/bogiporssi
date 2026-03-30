"use client";
import React from "react";

export interface HallOfFameItem {
  emoji: string;
  title: string;
  value: string;
  /** Toissijainen rivi (esim. joukkue MVP:lle, turnaus kovimmalle saldolle). */
  contextLine?: string;
  detail?: string;
  /** Sijat 2–5 tms. — näytetään klikattavassa laajennuksessa. */
  expandLines?: string[];
}

interface HallOfFameProps {
  items: HallOfFameItem[];
}

export default function HallOfFame({ items }: HallOfFameProps) {
  return (
    <section className="hof-section pm-section">
      <header className="hof-hero bp-card border-amber-400/20 p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="hof-kicker">BogiPörssi</p>
            <h2 className="hof-heading">Hall of Fame</h2>
            <p className="hof-lead">
              Kauden knoppitiedot ja erikoistittelit — pelaajat, managerit ja turnaukset numeroina.
            </p>
          </div>
          <div className="hof-hero-badge" aria-hidden>
            🏅
          </div>
        </div>
      </header>

      <div className="pm-grid">
        {items.map((item) => (
          <article key={item.title} className="hof-card pm-card pm-card--stack">
            <div className="flex gap-3 sm:gap-4">
              <div className="hof-emoji-wrap shrink-0" aria-hidden>
                <span className="hof-emoji">{item.emoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="hof-title">{item.title}</h3>
                <p className="hof-value break-words">{item.value}</p>
                {item.contextLine && <p className="hof-context">{item.contextLine}</p>}
                {item.detail && <p className="hof-detail">{item.detail}</p>}
                {item.expandLines && item.expandLines.length > 0 && (
                  <details className="hof-details">
                    <summary className="hof-details-summary">Näytä seuraavat sijat (2–5)</summary>
                    <ul className="hof-details-list">
                      {item.expandLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
