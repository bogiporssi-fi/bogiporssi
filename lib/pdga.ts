/** Virallinen pelaajaprofiili PDGA:n sivulla */
export function pdgaPlayerUrl(pdgaNumber: number): string {
  return `https://www.pdga.com/player/${pdgaNumber}`;
}

/** Lomake/admin: tyhjä → null; muuten kelvollinen positiivinen kokonaisluku, muuten null */
export function parsePdgaNumberInput(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Rating-CSV:n keskisarake (nimi; PDGA; rating).
 * Tyhjä → älä päivitä `pdga_number`-kenttää.
 * Numero → päivitä arvoon.
 */
export function parsePdgaCsvMiddleColumn(raw: string | undefined): number | null | undefined {
  const s = raw?.trim() ?? "";
  if (s === "") return undefined;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}
