"use client";
import React from "react";
import { breakdownFromPlayerRow } from "../../lib/pointsBreakdown";
import type { PlayerStatRow } from "../../lib/playerStats";
import PlayerPointsBreakdownPanel from "./PlayerPointsBreakdownPanel";
import TeamLogo from "./TeamLogo";
import TeamRoundTotalsStrip from "./TeamRoundTotalsStrip";

interface BoardEntry {
  uid?: string;
  name?: string;
  pts: number;
  isDQ?: boolean;
  lineup?: Array<{ playerName: string; points: number }>;
}

interface LeaderboardsProps {
  tab: "tournament" | "season";
  setTab: (val: "tournament" | "season") => void;
  boardMode: "teams" | "players";
  setBoardMode: (val: "teams" | "players") => void;
  playerTournamentRows: PlayerStatRow[];
  playerSeasonRows: PlayerStatRow[];
  activeBoard: BoardEntry[];
  profiles: any[];
  isLocked: boolean;
  viewerUserId: string;
  /** Admin näkee kaikkien rosterit myös ilman lukitusta (muuten vain oma joukkue). */
  viewerIsAdmin?: boolean;
  allTeamsPicks: any[];
  players: any[];
  getPrice: (rating: number, playerName?: string | null) => number;
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

function SeasonPlayerLineup({
  rows,
  playerInitials,
}: {
  rows: Array<{ playerName: string; points: number }>;
  playerInitials: (n: string) => string;
}) {
  return (
    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
      {rows.map((row, i) => (
        <div
          key={`${row.playerName}-${i}`}
          className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="pm-avatar pm-avatar--sm" aria-hidden>
              {playerInitials(row.playerName)}
            </div>
            <span className="truncate text-xs font-semibold text-white/90">{row.playerName}</span>
          </div>
          <span className="shrink-0 text-xs font-extrabold tabular-nums text-sky-200/95">{row.points} p</span>
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
  getPrice: (rating: number, playerName?: string | null) => number;
  getPickPoints: (pick: any) => number;
}) {
  const minPrice = getPrice(950);
  return (
    <div className="pm-roster-expanded mt-1.5 pt-1">
      <TeamRoundTotalsStrip picks={picks} players={players} variant="roster" className="mb-3" />
      <div className="space-y-2">
      {picks.map((pick) => {
        const pl = players.find((p) => String(p.id) === String(pick.player_id));
        const r = pl?.official_rating;
        const rating = r !== null && r !== undefined && r !== "" ? Number(r) : NaN;
        const price =
          pick.buy_price !== null && pick.buy_price !== undefined
            ? Math.max(minPrice, Number(pick.buy_price) || 0)
            : getPrice(Number.isFinite(rating) ? rating : 950, pl?.name);
        const breakdown = pl ? breakdownFromPlayerRow(pl) : null;
        const storedPts = pl != null ? Number(pl.points) || 0 : null;

        return (
          <div
            key={pick.id ?? pick.player_id}
            className="pm-roster-pick-row rounded-[10px] px-2.5 py-2"
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
            {breakdown && (
              <PlayerPointsBreakdownPanel
                breakdown={breakdown}
                storedPoints={storedPts}
                summaryLabel="Piste-erittely"
                className="mt-2"
              />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function SeasonTournamentBreakdown({
  lines,
}: {
  lines: NonNullable<PlayerStatRow["seasonByTournament"]>;
}) {
  return (
    <details className="pm-player-breakdown">
      <summary className="pm-player-breakdown-summary">Piste-erittely (kausi)</summary>
      <ul className="pm-player-breakdown-list">
        {lines.map((line) => (
          <li key={line.tournamentName}>
            <span className="text-white/85">{line.tournamentName}</span>
            <span className="mx-1 font-semibold text-white/45">·</span>
            <span className="font-extrabold tabular-nums text-sky-200/90">{line.points} p</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PlayerStatsTable({
  rows,
  tab,
}: {
  rows: PlayerStatRow[];
  tab: "tournament" | "season";
}) {
  if (rows.length === 0) {
    return (
      <div className="col-span-full rounded-[10px] border border-dashed border-white/15 bg-white/[0.03] p-5 text-center text-sm text-white/55 backdrop-blur">
        Ei pelaajia tässä näkymässä.
      </div>
    );
  }

  return (
    <div className="col-span-full min-w-0">
      <div className="pm-player-stats-outer">
        <div className="pm-player-stats-scroll">
          <table className="pm-player-stats-table text-left">
            <thead>
              <tr>
                <th scope="col">Sija</th>
                <th scope="col">Pelaaja</th>
                <th scope="col">Rating</th>
                <th scope="col">Pisteet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const rank = idx + 1;
                return (
                  <React.Fragment key={row.name}>
                    <tr
                      className={
                        idx % 2 === 0
                          ? "pm-player-stats-data-tr pm-player-stats-data-tr--shade"
                          : "pm-player-stats-data-tr"
                      }
                    >
                      <td
                        className={[
                          "tabular-nums",
                          rank <= 3 ? "pm-player-stats-rank--top3" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {rank}
                      </td>
                      <td className="min-w-0 max-w-[14rem] text-left align-middle">
                        <div className="pm-player-stats-name-wrap">
                          <span className="pm-avatar pm-avatar--sm shrink-0" aria-hidden>
                            {initials(row.name)}
                          </span>
                          <span className="min-w-0 truncate text-left font-semibold text-white/95" title={row.name}>
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap tabular-nums text-white/72">
                        {row.rating !== null ? row.rating : "—"}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <span
                          className={
                            row.pts === 0
                              ? "pm-player-stats-pts pm-player-stats-pts--zero"
                              : "pm-player-stats-pts"
                          }
                        >
                          {row.pts} p
                        </span>
                      </td>
                    </tr>
                    {tab === "tournament" && row.breakdown && (
                      <tr className="pm-player-breakdown-tr">
                        <td colSpan={4} className="!px-3 !py-1">
                          <PlayerPointsBreakdownPanel
                            breakdown={row.breakdown}
                            storedPoints={row.playerPointsStored}
                          />
                        </td>
                      </tr>
                    )}
                    {tab === "season" &&
                      row.seasonByTournament &&
                      row.seasonByTournament.length > 0 && (
                        <tr className="pm-player-breakdown-tr">
                          <td colSpan={4} className="!px-3 !py-1">
                            <SeasonTournamentBreakdown lines={row.seasonByTournament} />
                          </td>
                        </tr>
                      )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Leaderboards({
  tab,
  setTab,
  boardMode,
  setBoardMode,
  playerTournamentRows,
  playerSeasonRows,
  activeBoard,
  profiles,
  isLocked,
  viewerUserId,
  viewerIsAdmin = false,
  allTeamsPicks,
  players,
  getPrice,
  getPickPoints,
}: LeaderboardsProps) {
  const subTeams =
    tab === "tournament"
      ? "Fantasy-joukkueet: managerit joilla on tallennettuja valintoja tähän kisaan (picks). Ei sama kuin Pelaajat-välilehti."
      : "Koko kauden pisteet: arkistoidut kisat + tämänhetkisen kisan pisteet yhteen.";

  const subPlayers =
    tab === "tournament"
      ? "Kentän pelaajat (pelaajatori) — jokaisen tulos tästä kisasta (pisteet pelaajakortilta)."
      : "Kausi: arkistoidut kisat + nykyisen kisan tulos; kentällä olevat näkyvät myös nollapisteinä.";

  const sub = boardMode === "teams" ? subTeams : subPlayers;

  const canSeeRoster = (entry: BoardEntry) => {
    if (viewerIsAdmin) return true;
    if (isLocked) return true;
    const uid = resolveEntryUid(entry, tab, profiles);
    return String(uid ?? '') === String(viewerUserId ?? '');
  };

  return (
    <section className="pm-section">
      <div className="pm-toolbar">
        <div>
          <h2 className="pm-title">Tulokset</h2>
          <p className="pm-sub">{sub}</p>
          {boardMode === "teams" && (
            <p className="mt-1 text-[11px] text-white/40">
              {viewerIsAdmin
                ? "Admin: näet kaikkien joukkueiden rosterit. Muilla käyttäjillä näkyy vain oma joukkue, ellei kisa ole lukittu."
                : !isLocked
                  ? "Avaa oma rivi nähdäksesi rosterisi. Lukitse kisa nähdäksesi myös muiden joukkueiden pelaajat ja hankinnat."
                  : "Avaa rivi nähdäksesi valitut pelaajat (pisteet, rating, hankinta)."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <div className="bp-subtab-row">
            <button
              type="button"
              onClick={() => setBoardMode("teams")}
              className={["bp-tab", boardMode === "teams" ? "bp-tab-active" : ""].join(" ")}
            >
              Joukkueet
            </button>
            <button
              type="button"
              onClick={() => setBoardMode("players")}
              className={["bp-tab", boardMode === "players" ? "bp-tab-active" : ""].join(" ")}
            >
              Pelaajat
            </button>
          </div>
          <div className="bp-subtab-row">
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
      </div>

      <div className="pm-grid">
        {boardMode === "players" ? (
          <PlayerStatsTable
            rows={tab === "tournament" ? playerTournamentRows : playerSeasonRows}
            tab={tab}
          />
        ) : (
          <>
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
            const picks = allTeamsPicks.filter((p) => String(p.user_id ?? '') === String(entryUid));
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
            const lineup = entry.lineup?.length ? entry.lineup : [];
            expandable = lineup.length > 0;
            if (expandable) {
              expandedBody = <SeasonPlayerLineup rows={lineup} playerInitials={initials} />;
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
          </>
        )}
      </div>
    </section>
  );
}
