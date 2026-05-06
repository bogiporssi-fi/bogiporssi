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
