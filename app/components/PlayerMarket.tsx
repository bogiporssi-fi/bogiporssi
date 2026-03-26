"use client";
import React, { useMemo } from "react";
import TeamLogo from "./TeamLogo";
import { parseTeamLogoId } from "../../lib/teamLogos";

interface PlayerMarketProps {
  players: any[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  team: any[];
  budget: number;
  isLocked: boolean;
  onSelect: (id: string, rating: number) => void;
  onRemove: (playerId: string) => void;
  getPrice: (rating: number) => number;
  teamLogoPath?: string | null;
  teamLogoId?: string | null;
  teamDisplayName: string;
}

/** Fi-locale käyttää välilyöntejä tuhaterottimina — vaihdetaan sitovat välilyönnit ettei numero hajoa kahdelle riville */
function formatMoneyFi(n: number) {
  return n.toLocaleString("fi-FI").replace(/\s/g, "\u00A0");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PlayerMarket({
  players,
  searchTerm,
  setSearchTerm,
  team,
  budget,
  isLocked,
  onSelect,
  onRemove,
  getPrice,
  teamLogoPath,
  teamLogoId,
  teamDisplayName,
}: PlayerMarketProps) {
  const showTeamLogo = Boolean(teamLogoPath || parseTeamLogoId(teamLogoId));
  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /** Lasketaan tästä näkymästä: buy_price tallessa valinnoissa, muuten hinta ratingista */
  const spent = useMemo(() => {
    return team.reduce((acc: number, curr: any) => {
      const pl = players.find((p) => p.id === curr.player_id);
      const bp = curr.buy_price;
      if (bp != null && bp !== "") return acc + Number(bp);
      return acc + getPrice(Number(pl?.official_rating) || 950);
    }, 0);
  }, [team, players, getPrice]);
  const displayBudget = Number.isFinite(budget) && budget > 0 ? budget : 1_000_000;
  const over = spent > displayBudget;
  const fillPct = over ? 100 : Math.min(100, Math.max(0, (spent / displayBudget) * 100));
  const remaining = Math.max(0, displayBudget - spent);

  const barFillStyle: React.CSSProperties = over
    ? { background: "linear-gradient(90deg, #f87171 0%, #ef4444 100%)" }
    : { background: "linear-gradient(90deg, #34d399 0%, #10b981 55%, #059669 100%)" };

  return (
    <section className="pm-section">
      {showTeamLogo && (
        <div className="pm-pelaajatori-team-logo">
          <TeamLogo
            logoPath={teamLogoPath}
            logoId={teamLogoId}
            fallbackName={teamDisplayName}
            size="md"
            className="pm-pelaajatori-team-logo-img"
          />
          <div className="min-w-0 flex-1">
            <p className="pm-pelaajatori-team-logo-label">Joukkueesi</p>
            <p className="pm-pelaajatori-team-logo-name">{teamDisplayName}</p>
          </div>
        </div>
      )}
      <div className="pm-toolbar pm-toolbar--market">
        <div className="min-w-0">
          <h2 className="pm-title">Pelaajatori</h2>
          <p className="pm-sub">Etsi ja osta pelaajia joukkueeseen.</p>
        </div>
        <div className="pm-input-wrap">
          <input
            type="text"
            placeholder="Etsi nimellä…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bp-input"
          />
        </div>
      </div>

      <div
        className="pm-budget-card"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={displayBudget}
        aria-valuenow={Math.min(spent, displayBudget)}
        aria-label="Budjetin käyttö hankintojen perusteella"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-200/80">
            Budjetti
          </span>
          <span
            className={[
              "text-base font-extrabold tabular-nums tracking-tight",
              over ? "text-red-300" : "text-white",
            ].join(" ")}
          >
            {formatMoneyFi(spent)}
            <span className="text-sm font-semibold text-white/45"> / {formatMoneyFi(displayBudget)} €</span>
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]">
          <div
            className="h-full min-h-[10px] rounded-full shadow-[0_0_10px_rgba(52,211,153,0.2)] transition-[width] duration-300 ease-out"
            style={{
              width: `${fillPct}%`,
              minWidth: fillPct > 0 && fillPct < 0.5 ? 3 : undefined,
              ...barFillStyle,
            }}
          />
        </div>
      </div>

      <div className="pm-grid">
        {filteredPlayers
          .sort((a, b) => b.official_rating - a.official_rating)
          .map((p) => {
            const isPicked = team.some((t) => t.player_id === p.id);
            const price = getPrice(p.official_rating);
            const teamFull = team.length >= 5;
            const tooExpensive = !isPicked && price > remaining;
            const cannotBuy = isLocked || teamFull || tooExpensive;
            return (
              <article key={p.id} className="pm-card">
                <div className={["pm-row-dense", isPicked ? "pm-row-dense--team" : ""].filter(Boolean).join(" ")}>
                  <div className="pm-avatar" aria-hidden>
                    {initials(p.name)}
                  </div>
                  <h3 className="pm-name" title={p.name}>
                    {p.name}
                  </h3>
                  <div className="pm-nums" aria-label="Rating ja hinta">
                    <span className="pm-tag pm-tag-rating">
                      <span className="pm-tag-label">Rating</span>
                      <span className="pm-tag-value">{p.official_rating}</span>
                    </span>
                    <span className="pm-tag pm-tag-price">
                      <span className="pm-tag-label pm-tag-label-price">Hinta</span>
                      <span className="pm-tag-value pm-tag-value-price">
                        {formatMoneyFi(price)}
                        <span className="pm-eur-suffix">€</span>
                      </span>
                    </span>
                  </div>
                  {isPicked ? (
                    <div className="pm-row-dense-tail shrink-0">
                      <span className="pm-picked-pill">
                        Valittu
                      </span>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => onRemove(p.id)}
                          className="pm-remove"
                        >
                          Poista
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(p.id, p.official_rating)}
                      disabled={cannotBuy}
                      title={
                        tooExpensive
                          ? "Pelaaja on kalliimpi kuin jäljellä oleva budjetti"
                          : teamFull
                            ? "Joukkue täynnä (5/5)"
                            : undefined
                      }
                      className={[
                        "bp-btn-primary pm-buy",
                        cannotBuy ? "cursor-not-allowed opacity-40" : "",
                      ].join(" ")}
                    >
                      {isLocked ? "Lukittu" : teamFull ? "Täynnä" : tooExpensive ? "Ei budjettia" : "Osta"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
