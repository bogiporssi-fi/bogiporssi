export type TournamentFormat = 'singles' | 'mpo_pairs';

export const SINGLES_BUDGET = 1_000_000;
export const MPO_PAIRS_BUDGET = 600_000;

function tournamentFormatValue(tournament: unknown): unknown {
  return tournament != null && typeof tournament === 'object'
    ? (tournament as Record<string, unknown>).format
    : undefined;
}

export function getTournamentFormat(tournament: unknown): TournamentFormat {
  return tournamentFormatValue(tournament) === 'mpo_pairs' ? 'mpo_pairs' : 'singles';
}

export function isMpoPairsTournament(tournament: unknown): boolean {
  return getTournamentFormat(tournament) === 'mpo_pairs';
}

export function getTournamentRosterSize(tournament: unknown): number {
  return isMpoPairsTournament(tournament) ? 3 : 5;
}

export function getDefaultBudgetForFormat(format: TournamentFormat): number {
  return format === 'mpo_pairs' ? MPO_PAIRS_BUDGET : SINGLES_BUDGET;
}

export function getMarketEntityLabels(tournament: unknown) {
  return isMpoPairsTournament(tournament)
    ? { singular: 'pari', plural: 'paria', marketTitle: 'Paritori' }
    : { singular: 'pelaaja', plural: 'pelaajaa', marketTitle: 'Pelaajatori' };
}
