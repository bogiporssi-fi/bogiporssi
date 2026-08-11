export type PairMember = {
  name: string;
  rating: number;
  hometown?: string;
  state?: string;
  country?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function pairMembersFromPlayer(player: unknown): PairMember[] {
  const pairMembers = asRecord(player)?.pair_members;
  if (!Array.isArray(pairMembers)) return [];
  return pairMembers.flatMap((member): PairMember[] => {
    const row = asRecord(member);
    const name = row?.name;
    const rating = Number(row?.rating);
    if (typeof name !== 'string' || !name.trim() || !Number.isFinite(rating)) return [];
    return [{
      name: name.trim(),
      rating,
      hometown: typeof row?.hometown === 'string' ? row.hometown : undefined,
      state: typeof row?.state === 'string' ? row.state : undefined,
      country: typeof row?.country === 'string' ? row.country : undefined,
    }];
  });
}

export function isPairPlayer(player: unknown): boolean {
  return pairMembersFromPlayer(player).length === 2;
}

export function isPairHistoryRow(row: unknown): boolean {
  return asRecord(row)?.entry_type === 'pair';
}
