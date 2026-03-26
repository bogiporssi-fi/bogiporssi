/** Julkinen URL Storage-polulle (bucket: team-logos). */
export function publicTeamLogoUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) return "";
  const clean = storagePath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/team-logos/${clean}`;
}

/** Vanhat esilogot (bp-1 … bp-10) — näytetään vain jos team_logo_path puuttuu */
export function getTeamLogoPath(id: string): string {
  return `/team-logos/${id}.svg`;
}

export const LEGACY_TEAM_LOGO_IDS = [
  "bp-1",
  "bp-2",
  "bp-3",
  "bp-4",
  "bp-5",
  "bp-6",
  "bp-7",
  "bp-8",
  "bp-9",
  "bp-10",
] as const;

export function parseTeamLogoId(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return (LEGACY_TEAM_LOGO_IDS as readonly string[]).includes(raw) ? raw : null;
}
