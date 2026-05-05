"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { historySeasonBucket } from "../../lib/seasonSegment";
import {
  buildPlayerSeasonRows,
  earnedPointsFromHistoryRow,
  fantasyPlacementInBucket,
  positionBonusFromHistoryRow,
} from "../../lib/playerStats";

type Props = {
  player: any;
  players: any[];
  history: any[];
  activeTournament: any;
  getPrice: (rating: number, playerName?: string | null) => number;
  onClose: () => void;
};

const TITLE_ID = "pm-pc-title";

function formatMoneyFi(n: number) {
  return n.toLocaleString("fi-FI").replace(/\s/g, "\u00A0");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPar(par: unknown): string {
  if (par == null || par === "") return "—";
  const n = Number(par);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

function parClass(par: unknown): string {
  if (par == null || par === "") return "";
  const n = Number(par);
  if (!Number.isFinite(n)) return "";
  if (n < 0) return "pm-pc-par-good";
  if (n > 0) return "pm-pc-par-bad";
  return "";
}

export default function PlayerCard({
  player,
  players,
  history,
  activeTournament,
  getPrice,
  onClose,
}: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Body scroll-lock + focus management
  useEffect(() => {
    if (typeof document === "undefined") return;
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const formHistory = useMemo(() => {
    const raw = (history || []).filter((r) => r?.player_name === player?.name);
    /** Sama pelaaja + sama kisa voi esiintyä useita kertoja (pickit) — pidä paras fantasy-tulos. */
    const byBucket = new Map<string, any>();
    for (const r of raw) {
      const key = historySeasonBucket(r);
      const prev = byBucket.get(key);
      const pts = earnedPointsFromHistoryRow(r);
      if (!prev || pts > earnedPointsFromHistoryRow(prev)) byBucket.set(key, r);
    }
    const rows = Array.from(byBucket.values());
    rows.sort((a, b) => {
      const sa = Number(a?.season_segment);
      const sb = Number(b?.season_segment);
      if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sb - sa;
      const ca = a?.created_at ? Date.parse(a.created_at) : 0;
      const cb = b?.created_at ? Date.parse(b.created_at) : 0;
      return cb - ca;
    });
    return rows.slice(0, 8);
  }, [history, player?.name]);

  const seasonInfo = useMemo(() => {
    if (!player?.name) return null;
    const segNum = Number(activeTournament?.season_segment);
    const opts = {
      name: activeTournament?.name || "Aktiivinen kisa",
      seasonSegment: Number.isFinite(segNum) ? segNum : 1,
    };
    const rows = buildPlayerSeasonRows(history || [], players || [], opts);
    const row = rows.find((r) => r.name === player.name);
    if (!row) return null;
    const best = (row.seasonByTournament ?? []).reduce<{ name: string; pts: number } | null>(
      (acc, t) => {
        if (!acc || t.points > acc.pts) return { name: t.tournamentName, pts: t.points };
        return acc;
      },
      null
    );
    return { total: row.pts, best };
  }, [history, players, player?.name, activeTournament?.season_segment, activeTournament?.name]);

  const ratingNum = Number(player?.official_rating);
  const rating = Number.isFinite(ratingNum) ? ratingNum : null;
  const price = rating != null ? getPrice(rating, player?.name) : null;
  const playerName = player?.name || "Tuntematon pelaaja";

  const modal = (
    <div
      className="pm-pc-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pm-pc-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pm-pc-handle" aria-hidden />
        <header className="pm-pc-head">
          <div className="pm-pc-head-main">
            <div className="pm-avatar pm-pc-avatar" aria-hidden>
              {initials(playerName)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 id={TITLE_ID} className="pm-pc-title" title={playerName}>
                {playerName}
              </h2>
              <div className="pm-pc-tags">
                <span className="pm-tag pm-tag-rating">
                  <span className="pm-tag-label">Rating</span>
                  <span className="pm-tag-value">{rating != null ? rating : "—"}</span>
                </span>
                <span className="pm-tag pm-tag-price">
                  <span className="pm-tag-label pm-tag-label-price">Hinta</span>
                  <span className="pm-tag-value pm-tag-value-price">
                    {price != null ? formatMoneyFi(price) : "—"}
                    <span className="pm-eur-suffix">€</span>
                  </span>
                </span>
              </div>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="pm-pc-close"
            aria-label="Sulje pelaajakortti"
          >
            ×
          </button>
        </header>

        <div className="pm-pc-body">
        <section className="pm-pc-section">
          <h3 className="pm-pc-section-title">Form (viim. 8 kisaa)</h3>
          {formHistory.length === 0 ? (
            <p className="pm-pc-empty">Ei vielä historiaa — uusi pelaaja kentällä.</p>
          ) : (
            <div className="pm-pc-history" role="table" aria-label="Pelaajan viimeiset kisat">
              <div className="pm-pc-history-row pm-pc-history-head" role="row">
                <span className="pm-pc-h-tournament" role="columnheader">Kisa</span>
                <span className="pm-pc-h-num" role="columnheader">Par</span>
                <span className="pm-pc-h-num" role="columnheader">Krs</span>
                <span className="pm-pc-h-num" role="columnheader">Hot</span>
                <span className="pm-pc-h-num" role="columnheader">HIO</span>
                <span className="pm-pc-h-sij" role="columnheader" title="Sijoitusbonus">
                  Bonus
                </span>
                <span className="pm-pc-h-place" role="columnheader" title="Fantasy-sijoitus kisassa">
                  Sija
                </span>
                <span className="pm-pc-h-pts" role="columnheader">Yht.</span>
              </div>
              {formHistory.map((row, i) => {
                const par = row?.player_score;
                const hot = Number(row?.hot_rounds) || 0;
                const hio = Number(row?.hio_count) || 0;
                const krs = Number(row?.player_rounds) || 0;
                const pts = earnedPointsFromHistoryRow(row);
                const posBonus = positionBonusFromHistoryRow(row);
                const placement = fantasyPlacementInBucket(history, row, playerName);
                return (
                  <div
                    key={`${row?.tournament_name ?? "k"}-${row?.season_segment ?? "s"}-${i}`}
                    className="pm-pc-history-row"
                    role="row"
                  >
                    <span className="pm-pc-h-tournament" title={row?.tournament_name} role="cell">
                      {row?.tournament_name || "Tuntematon kisa"}
                    </span>
                    <span className={`pm-pc-h-num pm-pc-par ${parClass(par)}`} role="cell">
                      {formatPar(par)}
                    </span>
                    <span className="pm-pc-h-num" role="cell">{krs || "—"}</span>
                    <span className="pm-pc-h-num pm-pc-hot" role="cell">{hot > 0 ? hot : ""}</span>
                    <span className="pm-pc-h-num pm-pc-hio" role="cell">{hio > 0 ? hio : ""}</span>
                    <span className="pm-pc-h-sij" role="cell" title="Sijoitusbonus (10 / 5 / 2 p)">
                      {posBonus == null ? "—" : posBonus > 0 ? `+${posBonus}` : `${posBonus}`}
                    </span>
                    <span
                      className="pm-pc-h-place"
                      role="cell"
                      title="Fantasy-pisteillä laskettu sijoitus (tasapeli = sama sija)"
                    >
                      {placement ? `${placement.rank}/${placement.field}` : "—"}
                    </span>
                    <span className="pm-pc-h-pts" role="cell">
                      {pts}
                      <span className="pm-pc-pts-suffix"> p</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {seasonInfo && (
          <section className="pm-pc-section">
            <h3 className="pm-pc-section-title">Kausi yhteensä</h3>
            <p className="pm-pc-season">
              <span className="pm-pc-season-total">Kausi: {seasonInfo.total} p</span>
              {seasonInfo.best && seasonInfo.best.pts > 0 && (
                <span className="pm-pc-season-best">
                  {" · paras kisa: "}
                  <strong>{seasonInfo.best.pts} p</strong>
                  {" ("}{seasonInfo.best.name}{")"}
                </span>
              )}
            </p>
          </section>
        )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
