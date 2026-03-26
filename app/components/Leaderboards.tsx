"use client";
import React from "react";
import TeamLogo from "./TeamLogo";

interface BoardEntry {
  uid?: string;
  name?: string;
  pts: number;
  isDQ?: boolean;
  lineup?: Array<{ playerName: string; points: number }>;
  tournamentLines?: Array<{ tournamentName: string; points: number }>;
}

interface LeaderboardsProps {
  tab: "tournament" | "season";
  setTab: (val: "tournament" | "season") => void;
  activeBoard: BoardEntry[];
  profiles: any[];
  isLocked: boolean;
  viewerUserId: string;
  allTeamsPicks: any[];
  players: any[];
  getPrice: (rating: number) => number;
  getPickPoints: (pick: any) => number;
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

function resolveEntryUid(entry: BoardEntry, tab: "tournament" | "season", profiles: any[]): string | undefined {
  if (tab === "tournament") return entry.uid;
  const n = entry.name;
  if (!n) return undefined;
  return profiles.find((p: any) => p.team_name === n)?.id;
}

function SeasonTournamentLines({ rows }: { rows: Array<{ tournamentName: string; points: number }> }) {
  return (
    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
      {rows.map((row, i) => (
        <div
          key={`${row.tournamentName}-${i}`}
          className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5"
        >
          <span className="min-w-0 truncate text-xs font-semibold text-white/90">{row.tournamentName}</span>
          <span className="shrink-0 text-xs font-extrabold tabular-nums text-emerald-200/95">{row.points} p</span>
        </div>
      ))}
    </div>
  );
}

function TournamentPickRows({
  picks,
  players,
  getPrice,
  getPickPoints,
}: {
  picks: any[];
  players: any[];
  getPrice: (rating: number) => number;
  getPickPoints: (pick: any) => number;
}) {
  return (
    <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
      {picks.map((pick) => {
        const pl = players.find((p) => p.id === pick.player_id);
        const r = pl?.official_rating;
        const rating = r !== null && r !== undefined && r !== "" ? Number(r) : NaN;
        const price =
          pick.buy_price !== null && pick.buy_price !== undefined
            ? Number(pick.buy_price)
            : getPrice(Number.isFinite(rating) ? rating : 950);
        return (
          <div
            key={pick.id ?? pick.player_id}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
          >
            <div className="pm-row-dense">
              <div className="pm-avatar pm-avatar--sm" aria-hidden>
                {initials(pl?.name || "?")}
              </div>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/95">{pl?.name || "…"}</span>
              <div className="pm-nums">
                <span className="pm-tag pm-tag-points">
                  <span className="pm-tag-label pm-tag-label-points">Pisteet</span>
                  <span className="pm-tag-value pm-tag-value-points">{getPickPoints(pick)} p</span>
                </span>
                <span className="pm-tag pm-tag-rating">
                  <span className="pm-tag-label">Rating</span>
                  <span className="pm-tag-value">{Number.isFinite(rating) ? rating : "—"}</span>
                </span>
                <span className="pm-tag pm-tag-price">
                  <span className="pm-tag-label pm-tag-label-price">Hankinta</span>
                  <span className="pm-tag-value pm-tag-value-price">
                    {formatMoneyFi(price)}
                    <span className="pm-eur-suffix">€</span>
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leaderboards({
  tab,
  setTab,
  activeBoard,
  profiles,
  isLocked,
  viewerUserId,
  allTeamsPicks,
  players,
  getPrice,
  getPickPoints,
}: LeaderboardsProps) {
  const sub =
    tab === "tournament"
      ? "Vain tämän turnauksen pisteet — joukkueet joilla on valintoja."
      : "Koko kauden pisteet: arkistoidut kisat + tämänhetkisen kisan pisteet yhteen.";

  const canSeeRoster = (entry: BoardEntry) => {
    if (isLocked) return true;
    const uid = resolveEntryUid(entry, tab, profiles);
    return uid === viewerUserId;
  };

  return (
    <section className="pm-section">
      <div className="pm-toolbar">
        <div>
          <h2 className="pm-title">Tulokset</h2>
          <p className="pm-sub">{sub}</p>
          <p className="mt-1 text-[11px] text-white/40">
            {tab === "season" ? (
              !isLocked
                ? "Avaa oma rivi nähdäksesi kunkin kisan pisteet. Lukitse kisa nähdäksesi myös muiden tiimien erittelyn."
                : "Avaa rivi nähdäksesi kaikkien tiimien kunkin kisan pisteet."
            ) : !isLocked ? (
              "Avaa oma rivi nähdäksesi rosterisi. Lukitse kisa nähdäksesi myös muiden joukkueiden pelaajat ja hankinnat."
            ) : (
              "Avaa rivi nähdäksesi valitut pelaajat (pisteet, rating, hankinta)."
            )}
          </p>
        </div>
        <div className="bp-subtab-row shrink-0">
          <button
            type="button"
            onClick={() => setTab("tournament")}
            className={["bp-tab", tab === "tournament" ? "bp-tab-active" : ""].join(" ")}
          >
            Tämä kisa
          </button>
          <button
            type="button"
            onClick={() => setTab("season")}
            className={["bp-tab", tab === "season" ? "bp-tab-active" : ""].join(" ")}
          >
            Kausi
          </button>
        </div>
      </div>

      <div className="pm-grid">
        {activeBoard.length === 0 && (
          <div className="col-span-full rounded-[10px] border border-dashed border-white/15 bg-white/[0.03] p-5 text-center text-sm text-white/55 backdrop-blur">
            Ei vielä tuloksia tälle näkymälle.
          </div>
        )}

        {activeBoard.map((entry, idx) => {
          const userProfile = entry.uid
            ? profiles.find((p) => p.id === entry.uid)
            : entry.name
              ? profiles.find((p) => p.team_name === entry.name)
              : null;
          const displayName =
            entry.name ||
            userProfile?.team_name ||
            userProfile?.email?.split("@")[0] ||
            "Tiimi";
          const entryUid = resolveEntryUid(entry, tab, profiles);
          const show = canSeeRoster(entry);

          let expandable = false;
          let expandedBody: React.ReactNode = null;

          if (show && tab === "tournament" && entryUid) {
            const picks = allTeamsPicks.filter((p) => p.user_id === entryUid);
            expandable = picks.length > 0;
            if (expandable) {
              expandedBody = (
                <TournamentPickRows
                  picks={picks}
                  players={players}
                  getPrice={getPrice}
                  getPickPoints={getPickPoints}
                />
              );
            }
          } else if (show && tab === "season") {
            const lines = entry.tournamentLines?.length ? entry.tournamentLines : [];
            expandable = lines.length > 0;
            if (expandable) {
              expandedBody = <SeasonTournamentLines rows={lines} />;
            }
          }

          const rowHeader = (
            <div className="pm-row-dense">
              <TeamLogo
                logoPath={userProfile?.team_logo_path}
                logoId={userProfile?.team_logo_id}
                fallbackName={displayName}
                size="md"
              />
              <h3 className="pm-name" title={displayName}>
                {displayName}
              </h3>
              <div className="pm-nums" aria-label="Sijoitus ja pisteet">
                <span className="pm-tag pm-tag-rating">
                  <span className="pm-tag-label">Sija</span>
                  <span className="pm-tag-value">{idx + 1}</span>
                </span>
                {entry.isDQ ? (
                  <span className="pm-tag pm-tag-dq">
                    <span className="pm-tag-label pm-tag-label-dq">Tila</span>
                    <span className="pm-tag-value pm-tag-value-dq">DQ</span>
                  </span>
                ) : (
                  <span className="pm-tag pm-tag-points">
                    <span className="pm-tag-label pm-tag-label-points">Pisteet</span>
                    <span className="pm-tag-value pm-tag-value-points">{entry.pts} p</span>
                  </span>
                )}
              </div>
            </div>
          );

          const managerLine = (
            <p className="mt-1.5 pl-[34px] text-[11px] leading-snug text-white/42">
              Manageri:{" "}
              <span className="font-medium text-white/68">
                {userProfile?.full_name || userProfile?.email?.split("@")[0] || "—"}
              </span>
            </p>
          );

          const teamBlock = (
            <div className="w-full min-w-0">
              {rowHeader}
              {managerLine}
            </div>
          );

          return (
            <article key={entry.uid ?? entry.name ?? idx} className="pm-card pm-card--stack">
              {expandable ? (
                <details className="group min-w-0">
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">{teamBlock}</div>
                      <span
                        className="mt-1 shrink-0 text-[10px] text-white/35 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden
                      >
                        ▼
                      </span>
                    </div>
                  </summary>
                  {expandedBody}
                </details>
              ) : (
                teamBlock
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
