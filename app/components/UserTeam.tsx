"use client";
import React from "react";
import TeamLogo from "./TeamLogo";

interface UserTeamProps {
  team: any[];
  isLocked: boolean;
  onRemove: (id: string) => void;
  getPrice: (rating: number) => number;
  teamDisplayName: string;
  teamLogoPath?: string | null;
  teamLogoId?: string | null;
}

function formatMoneyFi(n: number) {
  return n.toLocaleString("fi-FI").replace(/\s/g, "\u00A0");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserTeam({
  team,
  isLocked,
  onRemove,
  getPrice,
  teamDisplayName,
  teamLogoPath,
  teamLogoId,
}: UserTeamProps) {
  return (
    <section className="pm-section">
      <div className="pm-toolbar">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <TeamLogo logoPath={teamLogoPath} logoId={teamLogoId} fallbackName={teamDisplayName} size="md" />
          <div className="min-w-0">
            <h2 className="pm-title">{teamDisplayName}</h2>
            <p className="pm-sub">{team.length}/5 pelaajaa valittu</p>
          </div>
        </div>
      </div>

      <div className="pm-grid">
        {team.length === 0 && (
          <div className="col-span-full rounded-[10px] border border-dashed border-white/15 bg-white/[0.03] p-5 text-center text-sm text-white/55 backdrop-blur">
            Tiimisi on tyhjä. Osta pelaajia Pelaajatorista.
          </div>
        )}

        {team.map((pick: any) => {
          const name = pick.players?.name || "…";
          const rawRating = pick.players?.official_rating;
          const rating =
            rawRating !== null && rawRating !== undefined && rawRating !== ""
              ? Number(rawRating)
              : NaN;
          const pts =
            pick.earned_points !== null && pick.earned_points !== undefined
              ? pick.earned_points
              : pick.players?.points ?? 0;
          const buy =
            pick.buy_price !== null && pick.buy_price !== undefined
              ? Number(pick.buy_price)
              : getPrice(Number.isFinite(rating) ? rating : 950);

          return (
            <article key={pick.player_id} className="pm-card">
              <div className="pm-row-dense pm-row-dense--team">
                <div className="pm-avatar" aria-hidden>
                  {initials(name)}
                </div>
                <h3 className="pm-name" title={name}>
                  {name}
                </h3>
                <div className="pm-row-dense-tail">
                  <div className="pm-nums" aria-label="Rating, pisteet ja hankintahinta">
                    <span className="pm-tag pm-tag-rating">
                      <span className="pm-tag-label">Rating</span>
                      <span className="pm-tag-value">{Number.isFinite(rating) ? rating : "—"}</span>
                    </span>
                    <span className="pm-tag pm-tag-points">
                      <span className="pm-tag-label pm-tag-label-points">Pisteet</span>
                      <span className="pm-tag-value pm-tag-value-points">{pts} p</span>
                    </span>
                    <span className="pm-tag pm-tag-price">
                      <span className="pm-tag-label pm-tag-label-price">Hankinta</span>
                      <span className="pm-tag-value pm-tag-value-price">
                        {formatMoneyFi(buy)}
                        <span className="pm-eur-suffix">€</span>
                      </span>
                    </span>
                  </div>
                  {!isLocked ? (
                    <button
                      type="button"
                      onClick={() => onRemove(pick.player_id)}
                      className="pm-remove"
                    >
                      Poista
                    </button>
                  ) : (
                    <span className="inline-flex shrink-0 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white/45">
                      Lukittu
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
