import type { PairMember } from './pairEntry';

export type DoublesFieldPair = {
  teamName: string;
  members: [PairMember, PairMember];
  averageRating: number;
};

export type DoublesFieldParseResult = {
  pairs: DoublesFieldPair[];
  errors: string[];
};

function delimiterForLine(line: string): string {
  const candidates = [';', '\t', ','];
  let best = ';';
  let bestCount = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === delimiter) count++;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase('fi').replace(/\s+/g, ' ');
}

function parseRating(raw: string): number | null {
  const value = Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(value) || value < 800 || value > 1100) return null;
  return Math.round(value);
}

export function parseDoublesFieldCsv(text: string): DoublesFieldParseResult {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 3) {
    return { pairs: [], errors: ['Tiedostossa ei ole otsikon lisäksi vähintään yhtä kahden pelaajan paria.'] };
  }

  const delimiter = delimiterForLine(lines[0]);
  const errors: string[] = [];
  const rawPairs: Array<{ teamName: string; members: PairMember[]; firstLine: number }> = [];
  let current: { teamName: string; members: PairMember[]; firstLine: number } | null = null;

  lines.slice(1).forEach((line, index) => {
    const lineNumber = index + 2;
    const columns = parseDelimitedLine(line, delimiter);
    const teamName = columns[0]?.trim() ?? '';
    const playerName = columns[1]?.trim() ?? '';
    const rating = parseRating(columns[2] ?? '');

    if (teamName) {
      if (current) rawPairs.push(current);
      current = { teamName, members: [], firstLine: lineNumber };
    } else if (!current) {
      errors.push(`Rivi ${lineNumber}: A-sarake on tyhjä eikä edeltävää joukkuetta ole.`);
      return;
    }

    if (!playerName) {
      errors.push(`Rivi ${lineNumber}: pelaajan nimi puuttuu B-sarakkeesta.`);
      return;
    }
    if (rating == null) {
      errors.push(`Rivi ${lineNumber}: C-sarakkeen rating "${columns[2] ?? ''}" ei ole kelvollinen.`);
      return;
    }
    if (!current) return;
    current.members.push({
      name: playerName,
      rating,
      hometown: columns[3]?.trim() || undefined,
      state: columns[4]?.trim() || undefined,
      country: columns[5]?.trim() || undefined,
    });
  });
  if (current) rawPairs.push(current);

  const seenTeams = new Set<string>();
  const seenPlayers = new Set<string>();
  const pairs: DoublesFieldPair[] = [];
  for (const pair of rawPairs) {
    const teamKey = normalizedKey(pair.teamName);
    if (seenTeams.has(teamKey)) {
      errors.push(`Rivi ${pair.firstLine}: joukkue "${pair.teamName}" esiintyy useammin kuin kerran.`);
    }
    seenTeams.add(teamKey);
    if (pair.members.length !== 2) {
      errors.push(
        `Rivi ${pair.firstLine}: joukkueella "${pair.teamName}" on ${pair.members.length} pelaajaa, mutta pitää olla täsmälleen 2.`
      );
      continue;
    }
    for (const member of pair.members) {
      const playerKey = normalizedKey(member.name);
      if (seenPlayers.has(playerKey)) {
        errors.push(`Pelaaja "${member.name}" esiintyy useammassa kuin yhdessä joukkueessa.`);
      }
      seenPlayers.add(playerKey);
    }
    pairs.push({
      teamName: pair.teamName,
      members: [pair.members[0], pair.members[1]],
      averageRating: Math.round((pair.members[0].rating + pair.members[1].rating) / 2),
    });
  }

  return { pairs: errors.length ? [] : pairs, errors };
}

export function decodeDoublesFieldCsv(buffer: ArrayBuffer): DoublesFieldParseResult & { encoding: string } {
  const encodings = ['utf-8', 'windows-1252', 'iso-8859-1'];
  let best: DoublesFieldParseResult | null = null;
  let bestEncoding = 'utf-8';
  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding).decode(buffer);
      const result = parseDoublesFieldCsv(text);
      if (result.errors.length === 0) return { ...result, encoding };
      if (!best || result.errors.length < best.errors.length) {
        best = result;
        bestEncoding = encoding;
      }
    } catch {
      // Kokeillaan seuraavaa Excelin mahdollista merkistöä.
    }
  }
  return { ...(best ?? { pairs: [], errors: ['CSV-tiedostoa ei voitu lukea.'] }), encoding: bestEncoding };
}
