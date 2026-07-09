/**
 * Turnauksen lukitus-tila clientille.
 * Älä käytä pelkkää truthy-tarkistusta: merkkijono "false" on JS:ssä truthy,
 * jolloin kisa näyttää lukittuna ja Tulokset paljastaa kaikkien rosterit.
 */
export function isTournamentLocked(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw == null) return false;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 't' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'f' || s === 'no' || s === '') return false;
  }
  return Boolean(raw);
}

export type TournamentLockFields = {
  is_locked?: unknown;
  lock_at?: string | null;
};

/** Manuaalinen lukitus tai ajastettu lock_at on mennyt. */
export function isTournamentEffectivelyLocked(tournament: TournamentLockFields | null | undefined): boolean {
  if (!tournament) return false;
  if (isTournamentLocked(tournament.is_locked)) return true;
  const lockAt = tournament.lock_at;
  if (!lockAt) return false;
  const ms = Date.parse(lockAt);
  return Number.isFinite(ms) && Date.now() >= ms;
}

/** datetime-local -syötteelle (paikallinen aika). */
export function lockAtToDatetimeLocalValue(lockAt: string | null | undefined): string {
  if (!lockAt) return '';
  const ms = Date.parse(lockAt);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → ISO (UTC) tallennusta varten. */
export function datetimeLocalValueToLockAtIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function formatLockAtFi(lockAt: string | null | undefined): string | null {
  if (!lockAt) return null;
  const ms = Date.parse(lockAt);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
