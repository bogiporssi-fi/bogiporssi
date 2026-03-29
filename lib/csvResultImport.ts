/**
 * Admin-tulosten tuonti CSV/tekstitiedostosta (Excel → Tallenna CSV UTF-8).
 */

export type ActivePlayer = {
  id: string;
  name: string;
  official_rating?: number | null;
};

export type ParsedStatUpdate = {
  playerId: string;
  par: number;
  rounds: number;
  hot: number;
  hio: number;
  pos: number;
  official_rating: number;
};

export type ParseResultsCsvOutcome = {
  updates: ParsedStatUpdate[];
  unknownNames: string[];
  parseWarnings: string[];
};

const HEADER_ALIASES: Record<string, ColumnKey> = {
  pelaaja: "name",
  nimi: "name",
  name: "name",
  player: "name",
  tulos: "par",
  par: "par",
  score: "par",
  kierrokset: "rounds",
  krs: "rounds",
  rounds: "rounds",
  hot: "hot",
  hio: "hio",
  hi: "hio",
  sija: "pos",
  sijoitus: "pos",
  pos: "pos",
  rating: "rating",
};

type ColumnKey = "name" | "par" | "rounds" | "hot" | "hio" | "pos" | "rating";

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Sama logiikka kuin admin-select: 10 / 5 / 2 / 0 */
export function parsePositionBonus(raw: string): number {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!t || t === "-" || t === "—") return 0;
  const n = Number(String(raw).trim().replace(",", "."));
  if (Number.isFinite(n) && [0, 2, 5, 10].includes(n)) return n;
  if (t === "1." || t === "1" || t.includes("1.sija") || t === "voitto") return 10;
  if (
    t === "2." ||
    t === "2" ||
    t === "3." ||
    t === "3" ||
    t.startsWith("2-3") ||
    t.includes("2.–3") ||
    t.includes("2-3.")
  )
    return 5;
  if (t.includes("t10") || t.includes("top10") || t.includes("top 10") || t.startsWith("4-10"))
    return 2;
  return 0;
}

function parseIntCell(v: string, defaultVal = 0): number {
  const s = v
    .trim()
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(",", ".");
  if (s === "" || s === "-") return defaultVal;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : defaultVal;
}

function parseRatingCell(v: string, fallback: number): number {
  const s = v.trim().replace(",", ".");
  if (s === "" || s === "-") return fallback;
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function detectDelimiter(headerLine: string): string {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;
  if (tab > semi && tab > comma) return "\t";
  return semi >= comma ? ";" : ",";
}

/** Yksinkertainen CSV-rivi: lainausmerkit sallittu */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === delimiter && !inQ) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** NFC + lowercase + tyhjät merkit — sama Excelin ja DB:n nimille. */
export function normalizePlayerNameKey(name: string): string {
  return name
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .normalize("NFC")
    .toLowerCase();
}

function buildNameIndex(players: ActivePlayer[]): Map<string, ActivePlayer> {
  const m = new Map<string, ActivePlayer>();
  for (const p of players) {
    const k = normalizePlayerNameKey(p.name);
    if (!m.has(k)) m.set(k, p);
  }
  return m;
}

/**
 * Ensimmäinen rivi = otsikot. Tuonti ylikirjoittaa samat kentät kuin admin-Tallenna.
 */
export function parseResultsCsv(text: string, activePlayers: ActivePlayer[]): ParseResultsCsvOutcome {
  const parseWarnings: string[] = [];
  const unknownNames: string[] = [];
  const updates: ParsedStatUpdate[] = [];

  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    parseWarnings.push("Tiedostossa pitää olla vähintään otsikkorivi ja yksi datarivi.");
    return { updates, unknownNames, parseWarnings };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = splitCsvLine(lines[0], delimiter).map((c) => normalizeHeader(c.replace(/^"|"$/g, "")));
  const colIndex: Partial<Record<ColumnKey, number>> = {};

  headerCells.forEach((h, i) => {
    const stripped = h.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    const key = HEADER_ALIASES[h] ?? HEADER_ALIASES[stripped];
    if (key) colIndex[key] = i;
  });

  if (colIndex.name === undefined) {
    parseWarnings.push('Otsikkoriviltä puuttuu pelaajan sarake (esim. "Pelaaja" tai "Nimi").');
    return { updates, unknownNames, parseWarnings };
  }

  const byName = buildNameIndex(activePlayers);

  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r], delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
    const nameIdx = colIndex.name!;
    const nameRaw = cells[nameIdx] ?? "";
    if (!nameRaw.trim()) continue;

    const pl = byName.get(normalizePlayerNameKey(nameRaw));
    if (!pl) {
      unknownNames.push(nameRaw.trim());
      continue;
    }

    const g = (k: ColumnKey) => {
      const idx = colIndex[k];
      if (idx === undefined || idx >= cells.length) return "";
      return cells[idx] ?? "";
    };

    const par = parseIntCell(g("par"), 0);
    const rounds = parseIntCell(g("rounds"), 0);
    const hot = parseIntCell(g("hot"), 0);
    const hio = parseIntCell(g("hio"), 0);
    const posRaw = g("pos");
    const pos = parsePositionBonus(posRaw);
    const fallbackRat = Number(pl.official_rating) || 950;
    const official_rating =
      colIndex.rating !== undefined ? parseRatingCell(g("rating"), fallbackRat) : fallbackRat;

    updates.push({
      playerId: pl.id,
      par,
      rounds,
      hot,
      hio,
      pos,
      official_rating,
    });
  }

  return { updates, unknownNames, parseWarnings };
}

type TextEncoding = "utf-8" | "windows-1252" | "iso-8859-1";

/**
 * Excel (Windows) tallentaa CSV:n usein ANSI/Windows-1252 — file.text() lukee UTF-8:na ja ääkköset menevät väärin,
 * jolloin nimet eivät täsmää tietokantaan ja tuonti näyttää nollia / ohittaa rivejä.
 * Kokeillaan useita dekoodauksia ja valitaan paras osumatulos.
 */
export function decodeAndParseResultsCsv(
  buf: ArrayBuffer,
  activePlayers: ActivePlayer[]
): ParseResultsCsvOutcome & { decodingUsed: TextEncoding } {
  const encodings: TextEncoding[] = ["utf-8", "windows-1252", "iso-8859-1"];
  let best: ParseResultsCsvOutcome | null = null;
  let bestScore = -Infinity;
  let decodingUsed: TextEncoding = "utf-8";

  for (const enc of encodings) {
    let text: string;
    try {
      text = new TextDecoder(enc).decode(buf);
    } catch {
      continue;
    }
    const out = parseResultsCsv(text, activePlayers);
    if (out.parseWarnings.length > 0) continue;
    const score = out.updates.length * 1000 - out.unknownNames.length * 100;
    if (score > bestScore) {
      bestScore = score;
      best = out;
      decodingUsed = enc;
    }
  }

  if (best) {
    return { ...best, decodingUsed };
  }

  const fallback = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  return { ...parseResultsCsv(fallback, activePlayers), decodingUsed: "utf-8" };
}
