/**
 * Admin-tulosten tuonti CSV/tekstitiedostosta (Excel → Tallenna CSV UTF-8).
 */

import { aggregatesFromStoredRounds, type RoundBreakdownStored } from "./roundBreakdown";

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
  /** null = ei kierrosdataa; lista = tallennetaan players.round_breakdown */
  roundBreakdown: RoundBreakdownStored | null;
};

export type ParseResultsCsvOutcome = {
  updates: ParsedStatUpdate[];
  unknownNames: string[];
  parseWarnings: string[];
};

export type ParseResultsCsvOptions = {
  /** Kierroksen tavoiteheitot (turnauksen asetus); rd_*-sarakkeisiin pakollinen */
  roundParStrokes: number | null;
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
  place: "placeRank",
};

type ColumnKey =
  | "name"
  | "par"
  | "rounds"
  | "hot"
  | "hio"
  | "pos"
  | "rating"
  | "placeRank";

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Sija 1→10, 2–3→5, 4–10→2, muut 0 */
export function positionBonusFromPlace(rank: number): number {
  if (!Number.isFinite(rank) || rank <= 0) return 0;
  if (rank === 1) return 10;
  if (rank >= 2 && rank <= 3) return 5;
  if (rank >= 4 && rank <= 10) return 2;
  return 0;
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

/** rd_1, rd_2, hot_round_1 tai hr_1, hio_1 */
function parseRdRoundColumnMaps(headerCells: string[]): {
  roundRdIndex: Map<number, number>;
  roundHotIndex: Map<number, number>;
  roundHioIndex: Map<number, number>;
  roundNumbers: number[];
} | null {
  const roundRdIndex = new Map<number, number>();
  const roundHotIndex = new Map<number, number>();
  const roundHioIndex = new Map<number, number>();

  const reRd = /^rd_(\d+)$/;
  const reHotRound = /^hot_round_(\d+)$/;
  const reHr = /^hr_(\d+)$/;
  const reHio = /^hio_(\d+)$/;

  headerCells.forEach((raw, i) => {
    const stripped = normalizeHeader(raw.replace(/^"|"$/g, ""))
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .trim();
    let m = stripped.match(reRd);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) roundRdIndex.set(n, i);
      return;
    }
    m = stripped.match(reHotRound);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) roundHotIndex.set(n, i);
      return;
    }
    m = stripped.match(reHr);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) roundHotIndex.set(n, i);
      return;
    }
    m = stripped.match(reHio);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) roundHioIndex.set(n, i);
    }
  });

  if (roundRdIndex.size === 0) return null;
  const roundNumbers = [...roundRdIndex.keys()].sort((a, b) => a - b);
  return { roundRdIndex, roundHotIndex, roundHioIndex, roundNumbers };
}

/** Otsikoista k1_par, k1_hot, k1_hio, k2_par, … */
function parseKRoundColumnMaps(headerCells: string[]): {
  roundParIndex: Map<number, number>;
  roundHotIndex: Map<number, number>;
  roundHioIndex: Map<number, number>;
  roundNumbers: number[];
} | null {
  const roundParIndex = new Map<number, number>();
  const roundHotIndex = new Map<number, number>();
  const roundHioIndex = new Map<number, number>();

  const rePar = /^k(\d+)_par$/;
  const reHot = /^k(\d+)_hot$/;
  const reHio = /^k(\d+)_hio$/;

  headerCells.forEach((raw, i) => {
    const stripped = normalizeHeader(raw.replace(/^"|"$/g, ""))
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .trim();
    let m = stripped.match(rePar);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) roundParIndex.set(n, i);
      return;
    }
    m = stripped.match(reHot);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) roundHotIndex.set(n, i);
      return;
    }
    m = stripped.match(reHio);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) roundHioIndex.set(n, i);
    }
  });

  if (roundParIndex.size === 0) return null;
  const roundNumbers = [...roundParIndex.keys()].sort((a, b) => a - b);
  return { roundParIndex, roundHotIndex, roundHioIndex, roundNumbers };
}

/**
 * Ensimmäinen rivi = otsikot. Tuonti ylikirjoittaa samat kentät kuin rivin Tallenna-nappi.
 * rd_* + roundParStrokes → heitot muunnetaan par-eroiksi. k1_par → suora par-ero.
 */
export function parseResultsCsv(
  text: string,
  activePlayers: ActivePlayer[],
  options: ParseResultsCsvOptions = { roundParStrokes: null }
): ParseResultsCsvOutcome {
  const { roundParStrokes } = options;
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
  const headerCells = splitCsvLine(lines[0], delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
  const colIndex: Partial<Record<ColumnKey, number>> = {};

  headerCells.forEach((h, i) => {
    const nh = normalizeHeader(h.replace(/^"|"$/g, ""));
    const stripped = nh.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    const key = HEADER_ALIASES[nh] ?? HEADER_ALIASES[stripped];
    if (key) colIndex[key] = i;
  });

  if (colIndex.name === undefined) {
    parseWarnings.push('Otsikkoriviltä puuttuu pelaajan sarake (esim. "Pelaaja", "Nimi" tai "name").');
    return { updates, unknownNames, parseWarnings };
  }

  const rdMaps = parseRdRoundColumnMaps(headerCells);
  const kRound = rdMaps ? null : parseKRoundColumnMaps(headerCells);

  if (rdMaps) {
    if (
      roundParStrokes == null ||
      !Number.isFinite(roundParStrokes) ||
      roundParStrokes <= 0
    ) {
      parseWarnings.push(
        'CSV:ssä on rd_*-sarakkeet (heitot): aseta Adminissa "Kierroksen par (heitot)" positiiviseksi luvuksi (esim. 54) ennen tuontia.'
      );
      return { updates, unknownNames, parseWarnings };
    }
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

    const fallbackRat = Number(pl.official_rating) || 950;
    const official_rating =
      colIndex.rating !== undefined ? parseRatingCell(g("rating"), fallbackRat) : fallbackRat;

    let par = parseIntCell(g("par"), 0);
    let rounds = parseIntCell(g("rounds"), 0);
    let hot = parseIntCell(g("hot"), 0);
    let hio = parseIntCell(g("hio"), 0);

    const posRaw = g("pos");
    let pos = 0;
    if (colIndex.pos !== undefined && posRaw.trim() !== "") {
      pos = parsePositionBonus(posRaw);
    } else if (colIndex.placeRank !== undefined) {
      const placeRaw = cells[colIndex.placeRank] ?? "";
      pos = positionBonusFromPlace(parseIntCell(placeRaw, 0));
    }

    let roundBreakdown: RoundBreakdownStored | null = null;

    if (rdMaps && roundParStrokes != null && roundParStrokes > 0) {
      const rb: RoundBreakdownStored = [];
      for (const n of rdMaps.roundNumbers) {
        const ri = rdMaps.roundRdIndex.get(n);
        if (ri === undefined) continue;
        const rdCell = cells[ri] ?? "";
        if (rdCell.trim() === "") continue;

        const strokes = parseIntCell(rdCell, 0);
        const parDelta = strokes - roundParStrokes;

        const hi = rdMaps.roundHotIndex.get(n);
        const ho = rdMaps.roundHioIndex.get(n);
        const hotCell = hi !== undefined && hi < cells.length ? cells[hi] ?? "" : "";
        const hioCell = ho !== undefined && ho < cells.length ? cells[ho] ?? "" : "";

        const hotN = Math.min(9, Math.max(0, parseIntCell(hotCell, 0)));
        const hioN = Math.min(9, Math.max(0, parseIntCell(hioCell, 0)));

        rb.push({
          n,
          par: parDelta,
          hot: hotN,
          hio: hioN,
        });
      }

      if (rb.length > 0) {
        roundBreakdown = rb;
        const agg = aggregatesFromStoredRounds(rb);
        par = agg.par;
        rounds = agg.rounds;
        hot = agg.hot;
        hio = agg.hio;
      }
    } else if (kRound) {
      const rb: RoundBreakdownStored = [];
      for (const n of kRound.roundNumbers) {
        const pi = kRound.roundParIndex.get(n);
        if (pi === undefined) continue;
        const parCell = cells[pi] ?? "";
        const hi = kRound.roundHotIndex.get(n);
        const ho = kRound.roundHioIndex.get(n);
        const hotCell = hi !== undefined && hi < cells.length ? cells[hi] ?? "" : "";
        const hioCell = ho !== undefined && ho < cells.length ? cells[ho] ?? "" : "";

        if (parCell.trim() === "" && hotCell.trim() === "" && hioCell.trim() === "") {
          continue;
        }

        rb.push({
          n,
          par: parseIntCell(parCell, 0),
          hot: parseIntCell(hotCell, 0),
          hio: parseIntCell(hioCell, 0),
        });
      }

      if (rb.length > 0) {
        roundBreakdown = rb;
        const agg = aggregatesFromStoredRounds(rb);
        par = agg.par;
        rounds = agg.rounds;
        hot = agg.hot;
        hio = agg.hio;
      }
    }

    updates.push({
      playerId: pl.id,
      par,
      rounds,
      hot,
      hio,
      pos,
      official_rating,
      roundBreakdown,
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
  activePlayers: ActivePlayer[],
  options: ParseResultsCsvOptions = { roundParStrokes: null }
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
    const out = parseResultsCsv(text, activePlayers, options);
    if (out.parseWarnings.length > 0) continue;
    const kBonus = out.updates.some((u) => u.roundBreakdown && u.roundBreakdown.length > 0) ? 50 : 0;
    const score = out.updates.length * 1000 - out.unknownNames.length * 100 + kBonus;
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
  return { ...parseResultsCsv(fallback, activePlayers, options), decodingUsed: "utf-8" };
}
