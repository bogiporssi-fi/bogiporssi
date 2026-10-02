import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TOURNAMENT_RESULTS_PAGE_SIZE,
  dedupePlayersOncePerTeamRoster,
  mergeTournamentResultPages,
  tournamentResultsOrderParam,
} from './tournamentResultRows';

type Row = {
  id?: string;
  created_at?: string;
  tournament_name?: string;
  season_segment?: number | null;
  user_id?: string | null;
  team_name?: string;
  player_name?: string;
  entry_type?: string;
  earned_points?: number;
};

function laatta(id: string, player: string, points: number, extra: Partial<Row> = {}): Row {
  return {
    id,
    created_at: '2026-07-24T09:11:42.457423+00:00',
    tournament_name: 'DGPT - Heinola Open',
    season_segment: 14,
    user_id: 'user-laatta',
    team_name: 'Laatta',
    player_name: player,
    entry_type: 'player',
    earned_points: points,
    ...extra,
  };
}

test('järjestys katkaisee created_at-tasapelin id:llä', () => {
  assert.equal(tournamentResultsOrderParam(), 'created_at.desc,id.desc');
  assert.equal(TOURNAMENT_RESULTS_PAGE_SIZE, 1000);
});

test('sivujen yhdistäminen palauttaa jokaisen id:n kerran ja säilyttää puuttuvan rivin', () => {
  const joona = laatta('joona', 'Joona Heinänen', 26);
  const bjorn = laatta('bjorn', 'Björn Marrandi', 40);
  const teemu = laatta('teemu', 'Teemu Talikainen', 30);
  const pages = [
    [joona, bjorn],
    [joona, teemu],
  ];
  const merged = mergeTournamentResultPages(pages);
  assert.deepEqual(
    merged.map((row) => row.id),
    ['joona', 'bjorn', 'teemu']
  );
  assert.equal(
    merged.reduce((sum, row) => sum + (row.earned_points ?? 0), 0),
    96
  );
});

test('rivit ilman id:tä säilyvät', () => {
  const merged = mergeTournamentResultPages<Row>([[{ player_name: 'A' }], [{ player_name: 'A' }]]);
  assert.equal(merged.length, 2);
});

test('rosterissa pelaaja lasketaan kerran per kisa, osa ja manageri', () => {
  const rows = [
    laatta('1', 'Joona Heinänen', 26),
    laatta('2', 'Joona Heinänen', 26),
    laatta('3', 'Calvin Heimburg', 50),
    laatta('4', 'Joona Heinänen', 26, { user_id: 'user-muu', team_name: 'Muu' }),
    laatta('5', 'Joona Heinänen', 26, { tournament_name: 'Muu kisa', season_segment: 15 }),
    laatta('6', 'Joona Heinänen', 10, { user_id: null, team_name: 'Legacy A' }),
    laatta('7', 'Joona Heinänen', 12, { user_id: null, team_name: 'Legacy B' }),
    laatta('8', 'Joona Heinänen', 99, { user_id: null, team_name: 'Legacy A' }),
  ];
  const roster = dedupePlayersOncePerTeamRoster(rows);
  const laattaJoona = roster.filter(
    (row) => row.team_name === 'Laatta' && row.player_name === 'Joona Heinänen' && row.season_segment === 14
  );
  assert.equal(laattaJoona.length, 1);
  assert.equal(laattaJoona[0]?.id, '1');
  assert.equal(roster.filter((row) => row.player_name === 'Calvin Heimburg').length, 1);
  assert.ok(roster.some((row) => row.team_name === 'Muu'));
  assert.ok(roster.some((row) => row.season_segment === 15));
  assert.equal(roster.filter((row) => row.user_id == null).length, 2);
  assert.equal(
    roster
      .filter((row) => row.team_name === 'Laatta' && row.season_segment === 14)
      .reduce((sum, row) => sum + (row.earned_points ?? 0), 0),
    76
  );
});

test('live-sivutus: ei duplikaatti-id:itä eikä puuttuvia rivejä', { timeout: 60_000 }, async (t) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    t.skip('NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY puuttuvat');
    return;
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };

  const countRes = await fetch(`${url}/rest/v1/tournament_results?select=id&limit=1`, {
    headers: { ...headers, Prefer: 'count=exact' },
  });
  assert.equal(countRes.ok, true);
  const total = Number(String(countRes.headers.get('content-range') || '').split('/')[1]);
  assert.ok(Number.isFinite(total) && total > 0);

  const select = 'id,tournament_name,season_segment,user_id,team_name,player_name,entry_type,earned_points';
  const orderBy = tournamentResultsOrderParam();
  const pages: Row[][] = [];
  for (let offset = 0; ; offset += TOURNAMENT_RESULTS_PAGE_SIZE) {
    const pageUrl: string =
      `${url}/rest/v1/tournament_results?select=${encodeURIComponent(select)}` +
      `&order=${orderBy}&limit=${TOURNAMENT_RESULTS_PAGE_SIZE}&offset=${offset}`;
    const res: Response = await fetch(pageUrl, { headers });
    if (!res.ok) {
      assert.fail(await res.text());
    }
    const page = (await res.json()) as Row[];
    pages.push(page);
    if (page.length < TOURNAMENT_RESULTS_PAGE_SIZE) break;
  }

  const merged = mergeTournamentResultPages(pages);
  const ids = merged.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, total);
  assert.equal(
    pages.reduce((sum, page) => sum + page.length, 0),
    total,
    'vakaa järjestys ei saa tuoda ylimääräisiä rivejä sivujen rajalta'
  );

  const roster = dedupePlayersOncePerTeamRoster(merged);
  assert.equal(roster.length, merged.length, 'kannassa ei ole loogisia rosteriduplikaatteja');

  const laatta = roster.filter(
    (row) =>
      row.tournament_name === 'DGPT - Heinola Open' &&
      Number(row.season_segment) === 14 &&
      row.team_name === 'Laatta'
  );
  const players = laatta.map((row) => row.player_name);
  assert.equal(laatta.length, 5);
  assert.equal(new Set(players).size, 5);
  assert.equal(players.filter((name) => name === 'Joona Heinänen').length, 1);
  assert.equal(
    laatta.reduce((sum, row) => sum + (Number(row.earned_points) || 0), 0),
    182
  );
});
