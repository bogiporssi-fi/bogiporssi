"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from 'react';
import { isRefreshTokenAuthError, recoverFromStaleSupabaseAuth, supabase } from '../lib/supabase';
import AdminPanel from './components/AdminPanel';
import PlayerMarket from './components/PlayerMarket';
import UserTeam from './components/UserTeam';
import Leaderboards from './components/Leaderboards';
import HallOfFame from './components/HallOfFame';
import TeamLogo from './components/TeamLogo';
import { parseTeamLogoId } from '../lib/teamLogos';
import { decodeAndParseResultsCsv } from '../lib/csvResultImport';
import type { RoundBreakdownStored } from '../lib/roundBreakdown';
import { buildPlayerSeasonRows, buildPlayerTournamentRows } from '../lib/playerStats';

// ADMIN-TUNNUS
const ADMIN_EMAIL = 'kimmo@gmail.com';

// HINNOITTELUKAAVA: (Rating - 950) * 2600
const getPrice = (rating: number) => {
  const diff = rating - 950;
  return diff > 0 ? diff * 2600 : 0;
};

function formatMoneyFi(n: number) {
  return n.toLocaleString('fi-FI').replace(/\s/g, '\u00A0');
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Supabase/PostgREST virheet eivät aina näy console.errorissa oikein (tyhjä {}). */
function formatSupabaseErr(err: unknown): string {
  if (err == null) return 'Tuntematon virhe.';
  if (typeof err === 'string') return err;
  const e = err as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };
  const parts = [e.message, e.details, e.hint].filter((s) => typeof s === 'string' && s.length > 0);
  if (parts.length) return parts.join(' — ');
  if (e.code) return `Virhekoodi: ${e.code}`;
  try {
    const s = JSON.stringify(err);
    if (s && s !== '{}') return s;
  } catch {
    /* ignore */
  }
  return (
    'Virhe ilman viestiä. Tarkista että profiles-taulussa on team_logo_path ja Storage-bucket team-logos (katso supabase/migrations/).'
  );
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export default function Home() {
  // --- TILANHALLINTA (States) ---
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [activeTournament, setActiveTournament] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]); // Tämä on käyttäjän oma joukkue
  const [allTeamsPicks, setAllTeamsPicks] = useState<any[]>([]); // Vakoilua varten
  const [history, setHistory] = useState<any[]>([]);
  
  const [leaderboardTab, setLeaderboardTab] = useState<'tournament' | 'season'>('tournament');
  const [resultsBoard, setResultsBoard] = useState<'teams' | 'players'>('teams');
  const [mainTab, setMainTab] = useState<
    'market' | 'team' | 'results' | 'hall' | 'rules' | 'history' | 'admin'
  >('market');
  const [searchTerm, setSearchTerm] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');
  /** Supabase Storage -polku (team-logos / {userId}/logo.ext) */
  const [teamLogoPath, setTeamLogoPath] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const teamLogoFileRef = useRef<HTMLInputElement>(null);

  const BUDGET = 1000000;

  // --- KIRJAUTUMISEN SEURANTA ---
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error && isRefreshTokenAuthError(error)) {
        await recoverFromStaleSupabaseAuth();
        if (cancelled) return;
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        loadData();
      } else {
        setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadData();
      } else {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // --- TIEDON HAKU (Load Data) ---
  async function loadData() {
    setLoading(true);
    try {
      // 1. Haetaan perustiedot
      const { data: t } = await supabase.from('tournaments').select('*').eq('is_active', true).single();
      if (t) setActiveTournament(t);

      const { data: p } = await supabase.from('players').select('*');
      const allPlayers = p || [];
      setPlayers(allPlayers);

      const { data: profs } = await supabase.from('profiles').select('*');
      if (profs) setProfiles(profs);

      // 2. Haetaan historiikki
      const { data: hist } = await supabase.from('tournament_results').select('*').order('created_at', { ascending: false });
      if (hist) setHistory(hist);

      // 3. Haetaan valinnat ja LIIMATAAN pelaajatiedot niihin heti
      const picksQuery = supabase.from('picks').select('*');
      // Jos turnaus on olemassa, haetaan oletuksena vain aktiivisen turnauksen valinnat
      const { data: allPicksRaw } = t?.id ? await picksQuery.eq('tournament_id', t.id) : await picksQuery;
      
      const allPicksWithPlayers = (allPicksRaw || []).map(pick => {
        const playerDetails = allPlayers.find(pl => pl.id === pick.player_id);
        return {
          ...pick,
          players: playerDetails, // Supabase-tyylinen liitos
          ...playerDetails        // Litteä tyyli (nimi, rating jne. suoraan tässä)
        };
      });

      setAllTeamsPicks(allPicksWithPlayers);

      // 4. Asetetaan oma joukkue
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr && isRefreshTokenAuthError(sessionErr)) {
        await recoverFromStaleSupabaseAuth();
        setUser(null);
        return;
      }
      const myId = session?.user?.id;
      
      if (myId) {
        // Suodatetaan omat valinnat valmiiksi liimatusta listasta
        const myTeam = allPicksWithPlayers.filter(pick => pick.user_id === myId);
        setTeam(myTeam);

        if (profs) {
          const myProfile = profs.find((pr: any) => pr.id === myId);
          if (myProfile?.team_name) setTeamNameInput(myProfile.team_name);
          setTeamLogoPath(typeof myProfile?.team_logo_path === 'string' ? myProfile.team_logo_path : null);
        }
      }
    } catch (error) {
      console.error("Nyt tuli virhe:", error);
    } finally {
      setLoading(false);
    }
  }
  // --- ADMIN TOIMINNOT ---

  async function startNewTournament() {
    if (!activeTournament) return;
    
    // Tarkistetaan nimen tilanne
    let kisanNimi = activeTournament.name;
    if (!kisanNimi || kisanNimi === 'Uusi Turnaus') {
      const askName = prompt("Anna kisan nimi arkistointia varten:", "Viikkokisa " + new Date().toLocaleDateString());
      if (!askName) return; // Käyttäjä perui
      kisanNimi = askName;
    }

    const confirmStart = confirm(`Arkistoidaanko kisa nimellä "${kisanNimi}"? Tämä tyhjentää pelaajien pisteet ja kaikkien joukkueet.`);
    
    if (confirmStart) {
      const archiveData: any[] = [];
      const { data: currentPicks } = await supabase.from('picks').select('*');
      
      if (currentPicks && currentPicks.length > 0) {
        currentPicks.forEach(pick => {
          const player = players.find(p => p.id === pick.player_id);
          const profile = profiles.find(pr => pr.id === pick.user_id);
          
          if (player && profile) {
            // Lasketaan pisteet arkistoon
            const par = Number(player.par_score) || 0;
            const pts = (par < 0 ? Math.abs(par) * 2 : par * -1) + (Number(player.rounds_played) * 2) + (Number(player.hot_rounds) * 5) + (Number(player.hio_count) * 30) + (Number(player.position_bonus) || 0);

            archiveData.push({
              tournament_name: kisanNimi, // Käytetään oikeaa nimeä
              manager_name: profile.full_name || 'Tuntematon',
              team_name: profile.team_name || 'Nimetön tiimi',
              user_id: pick.user_id,
              player_name: player.name,
              player_score: player.par_score,
              player_rounds: player.rounds_played,
              earned_points: pts,
              buy_price: pick.buy_price ?? null
            });
          }
        });
        if (archiveData.length > 0) {
          const missingColumnErr = (err: { message?: string } | null, col: string) => {
            const m = (err?.message || '').toLowerCase();
            return (
              m.includes(col) &&
              (m.includes('column') || m.includes('schema') || m.includes('not exist'))
            );
          };
          let batch: any[] = archiveData;
          let insErr = (await supabase.from('tournament_results').insert(batch)).error;
          if (insErr && missingColumnErr(insErr, 'user_id')) {
            batch = batch.map(({ user_id, ...rest }) => rest);
            insErr = (await supabase.from('tournament_results').insert(batch)).error;
          }
          if (insErr && missingColumnErr(insErr, 'buy_price')) {
            batch = batch.map(({ buy_price, ...rest }) => rest);
            insErr = (await supabase.from('tournament_results').insert(batch)).error;
          }
          if (insErr) throw insErr;
        }
      }

      // Nollataan pelaajien tiedot ja poistetaan valinnat
      await supabase
        .from('players')
        .update({
          points: 0,
          par_score: 0,
          rounds_played: 0,
          hot_rounds: 0,
          hio_count: 0,
          position_bonus: 0,
          round_breakdown: null,
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('picks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Palautetaan turnauksen nimi alkutilaan
      await supabase.from('tournaments').update({ is_locked: false, name: 'Uusi Turnaus' }).eq('id', activeTournament.id);

      alert(`Kisa "${kisanNimi}" arkistoitu onnistuneesti!`);
      loadData();
    }
  }

  async function updateTournamentName(newName: string) {
    if (!activeTournament) return;
    await supabase.from('tournaments').update({ name: newName }).eq('id', activeTournament.id);
    setActiveTournament({ ...activeTournament, name: newName });
  }

  async function updateTournamentRoundParStrokes(value: number | null) {
    if (!activeTournament?.id) return;
    const payload =
      value != null && Number.isFinite(value) && value > 0 ? { round_par_strokes: Math.round(value) } : { round_par_strokes: null };
    const { error } = await supabase.from('tournaments').update(payload).eq('id', activeTournament.id);
    if (error) {
      alert('Kierroksen par -tallennus epäonnistui: ' + formatSupabaseErr(error));
      return;
    }
    setActiveTournament({ ...activeTournament, round_par_strokes: payload.round_par_strokes });
  }

  async function handleRatingImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').slice(1); 
      await supabase.from('players').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      for (const row of rows) {
        if (!row.trim()) continue;
        const columns = row.includes(';') ? row.split(';') : row.split(',');
        const name = columns[0]?.trim();
        const newRat = parseInt(columns[2]?.trim());
        if (name && !isNaN(newRat)) {
          const { data } = await supabase.from('players').update({ official_rating: newRat, is_active: true }).ilike('name', name).select();
          if (!data || data.length === 0) {
            await supabase.from('players').insert([{ name, official_rating: newRat, is_active: true, points: 0, par_score: 0 }]);
          }
        }
      }
      alert("Ratingit päivitetty!");
      loadData();
    };
    reader.readAsText(file, 'windows-1252');
  }

  async function persistPlayerStats(
    pId: string,
    par: number,
    rounds: number,
    hot: number,
    hio: number,
    pos: number,
    newRat: number,
    options?: { skipLoadData?: boolean; roundBreakdown?: RoundBreakdownStored | null }
  ): Promise<{ ok: boolean; message?: string }> {
    const scorePoints = par < 0 ? Math.abs(par) * 2 : par * -1;
    const finalPoints = scorePoints + rounds * 2 + hot * 5 + hio * 30 + pos;
    const payload: Record<string, unknown> = {
      par_score: par,
      rounds_played: rounds,
      hot_rounds: hot,
      hio_count: hio,
      position_bonus: pos,
      points: finalPoints,
      official_rating: newRat,
    };
    if (options?.roundBreakdown !== undefined) {
      payload.round_breakdown = options.roundBreakdown;
    }
    const { error: e1 } = await supabase.from('players').update(payload).eq('id', pId);
    if (e1) return { ok: false, message: formatSupabaseErr(e1) };
    if (activeTournament?.id) {
      const { error: e2 } = await supabase
        .from('picks')
        .update({ earned_points: finalPoints })
        .eq('player_id', pId)
        .eq('tournament_id', activeTournament.id);
      if (e2) return { ok: false, message: formatSupabaseErr(e2) };
    }
    if (!options?.skipLoadData) loadData();
    return { ok: true };
  }

  async function saveAdminStats(pId: string, par: number, rounds: number, hot: number, hio: number, pos: number, newRat: number) {
    const r = await persistPlayerStats(pId, par, rounds, hot, hio, pos, newRat, { roundBreakdown: null });
    if (!r.ok) {
      alert('Tallennus epäonnistui: ' + (r.message || 'tuntematon virhe'));
    }
  }

  async function importResultsFromCsvFile(file: File) {
    const buf = await file.arrayBuffer();
    const active = players.filter((p) => p.is_active);
    const rps = activeTournament?.round_par_strokes;
    const roundParStrokes =
      rps != null && Number.isFinite(Number(rps)) && Number(rps) > 0 ? Number(rps) : null;
    const { updates, unknownNames, parseWarnings, decodingUsed } = decodeAndParseResultsCsv(buf, active, {
      roundParStrokes,
    });
    if (parseWarnings.length > 0) {
      alert(parseWarnings.join('\n'));
      return;
    }
    if (updates.length === 0 && unknownNames.length === 0) {
      alert('Ei yhtään päivitettävää riviä.');
      return;
    }
    let ok = 0;
    let firstErr: string | undefined;
    for (const u of updates) {
      const r = await persistPlayerStats(u.playerId, u.par, u.rounds, u.hot, u.hio, u.pos, u.official_rating, {
        skipLoadData: true,
        roundBreakdown: u.roundBreakdown,
      });
      if (r.ok) ok += 1;
      else if (!firstErr) firstErr = r.message;
    }
    await loadData();
    const unk =
      unknownNames.length > 0
        ? `\n\nTuntemattomat nimet (${unknownNames.length}): ${unknownNames.slice(0, 15).join(', ')}${unknownNames.length > 15 ? '…' : ''}`
        : '';
    const err = firstErr ? `\n\nVirheitä tallennuksessa: ${firstErr}` : '';
    const encHint =
      unknownNames.length > 0
        ? decodingUsed !== 'utf-8'
          ? `\n\nTiedosto tulkitaan koodauksella ${decodingUsed} (Windows Excel usein). Jos nimet ovat pielessä, tallenna CSV UTF-8.`
          : '\n\nTarkista että nimet täsmäävät BogiPörssiin (ääkköset, välilyönnit).'
        : decodingUsed !== 'utf-8'
          ? `\n\nLuettu: ${decodingUsed}.`
          : '';
    alert(`Tuonti valmis.\nPäivitetty: ${ok} pelaajaa.${unk}${err}${encHint}`);
  }

  async function toggleTournamentLock() {
    if (!activeTournament) return;
    await supabase.from('tournaments').update({ is_locked: !activeTournament.is_locked }).eq('id', activeTournament.id);
    loadData();
  }

  // --- PELILOGIIKKA (Osto & Poisto) ---

  async function updateTeamName(newName: string) {
    if (!newName.trim()) return alert("Nimi ei voi olla tyhjä!");
    const pr = profiles.find((p: any) => p.id === user.id);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      team_name: newName,
      email: user.email,
      team_logo_path: teamLogoPath ?? pr?.team_logo_path ?? null,
      team_logo_id: pr?.team_logo_id ?? null,
    });
    if (error) {
      console.error('updateTeamName', error, formatSupabaseErr(error));
      alert('Tallennus epäonnistui: ' + formatSupabaseErr(error));
      return;
    }
    alert("Joukkueen tiedot tallennettu!");
    loadData();
  }

  async function uploadTeamLogo(file: File) {
    if (!user?.id) return;
    const ext = LOGO_MIME_TO_EXT[file.type];
    if (!ext) {
      alert('Sallitut kuvat: PNG, JPEG, WebP tai GIF.');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      alert('Kuva on liian suuri (max. 2 Mt).');
      return;
    }
    const path = `${user.id}/logo.${ext}`;
    setUploadingLogo(true);
    try {
      const { error: upErr } = await supabase.storage
        .from('team-logos')
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (upErr) {
        alert('Kuvan lähetys epäonnistui: ' + formatSupabaseErr(upErr));
        return;
      }
      const pr = profiles.find((p: any) => p.id === user.id);
      const name = teamNameInput.trim() || pr?.team_name || 'Nimetön tiimi';
      const { error: dbErr } = await supabase.from('profiles').upsert({
        id: user.id,
        team_name: name,
        email: user.email,
        team_logo_path: path,
        team_logo_id: null,
      });
      if (dbErr) {
        alert('Tallennus epäonnistui: ' + formatSupabaseErr(dbErr));
        return;
      }
      setTeamLogoPath(path);
      await loadData();
    } finally {
      setUploadingLogo(false);
      if (teamLogoFileRef.current) teamLogoFileRef.current.value = '';
    }
  }

  async function removeTeamLogo() {
    if (!user?.id) return;
    const pr = profiles.find((p: any) => p.id === user.id);
    const path = teamLogoPath ?? (typeof pr?.team_logo_path === 'string' ? pr.team_logo_path : null);
    if (path) {
      const { error: rmErr } = await supabase.storage.from('team-logos').remove([path]);
      if (rmErr) console.warn('Storage poisto:', rmErr);
    }
    const name = teamNameInput.trim() || pr?.team_name || 'Nimetön tiimi';
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      team_name: name,
      email: user.email,
      team_logo_path: null,
      team_logo_id: null,
    });
    if (error) {
      alert('Logon poisto epäonnistui: ' + formatSupabaseErr(error));
      return;
    }
    setTeamLogoPath(null);
    loadData();
  }

  function onTeamLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void uploadTeamLogo(f);
  }

  const calculateTeamCost = (teamPicks: any[]) => {
    return teamPicks.reduce((acc, curr) => {
      const playerInfo = players.find(p => p.id === curr.player_id);
      return acc + (curr.buy_price || getPrice(playerInfo?.official_rating || 950));
    }, 0);
  };

  async function selectPlayer(pId: string, rating: number) {
    if (activeTournament?.is_locked) return alert("Turnaus on lukittu!");
    if (team.length >= 5) return alert("Tiimi on täynnä!");
    const price = getPrice(rating);
    if (calculateTeamCost(team) + price > BUDGET) return alert("Budjetti ei riitä!");
    
    await supabase.from('picks').insert([{ 
      player_id: pId, 
      user_id: user.id, 
      tournament_id: activeTournament?.id, 
      buy_price: price 
    }]);
    loadData();
  }

  async function removePlayer(pId: string) {
    if (activeTournament?.is_locked) return alert("Turnaus on lukittu!");
    // Poistetaan vain aktiivisen turnauksen pick (jos turnaus löytyy)
    const q = supabase.from('picks').delete().eq('player_id', pId).eq('user_id', user.id);
    if (activeTournament?.id) await q.eq('tournament_id', activeTournament.id);
    else await q;
    loadData();
  }

  // --- AUTH HANDLERS ---
  const handleLogin = async () => {
    const cleanEmail = email.replace(/\s/g, "").toLowerCase();
    // Käytännössä mobiililta kopioidut salasanat voivat sisältää piilovälejä lopussa (tai NBSP).
    const cleanPassword = password.replace(/\s/g, "");

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (error) {
      const msg = error.message || "Tuntematon virhe";
      const code = (error as any).code ? String((error as any).code) : "";
      const status = (error as any).status ? String((error as any).status) : "";
      alert(
        `Kirjautuminen epäonnistui: ${msg}` +
          (code ? `\nKoodi: ${code}` : "") +
          (status ? `\nStatus: ${status}` : "")
      );
    }
  };

  const handleSignUp = async () => {
    const cleanEmail = email.replace(/\s/g, "").toLowerCase();
    const cleanPassword = password.replace(/\s/g, "");

    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password: cleanPassword });
    if (error) {
      alert("Rekisteröinti epäonnistui: " + (error.message || "Tuntematon virhe"));
      return;
    }

    // Yritetään kirjautua heti, jotta tiedetään että salasana on varmasti oikein
    // myös mobiilin mahdollisten piilovälien jälkeen.
    if (data?.session?.user) {
      alert("Tunnus luotu! Kirjauduttu sisään.");
      void loadData();
      return;
    }

    const { data: signInData, error: signInErr } =
      await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });

    if (signInErr) {
      const msg = signInErr.message || "Tuntematon virhe";
      alert(
        "Rekisteröinti onnistui, mutta kirjautuminen ei onnistunut heti:\n" +
          msg +
          "\n\nTässä vaiheessa vahvista, että salasana on varmasti oikein (mobiililla voi tulla piilovälejä)."
      );
      return;
    }

    if (signInData?.session?.user) {
      alert("Tunnus luotu! Kirjauduttu sisään.");
      void loadData();
      return;
    }

    alert("Tunnus luotu. Kirjaudu sisään (session ei tullut heti).");
  };

  if (loading && !user) return <div style={{ padding: '50px', textAlign: 'center' }}>Ladataan BogiPörssiä...</div>;

  if (!user) return (
    <main style={{ padding: '40px', textAlign: 'center', background: '#111', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <h1>BogiPörssi 2026</h1>
      <div style={{ maxWidth: '350px', margin: '30px auto', background: '#222', padding: '25px', borderRadius: '15px' }}>
        <input type="email" placeholder="Sähköposti" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', background: '#111', color: 'white', border: '1px solid #444' }} />
        <input type="password" placeholder="Salasana" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', background: '#111', color: 'white', border: '1px solid #444' }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#0070f3', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Kirjaudu</button>
        <button onClick={handleSignUp} style={{ background: 'none', border: 'none', color: '#888', marginTop: '15px', cursor: 'pointer' }}>Luo uusi tunnus</button>
      </div>
    </main>
  );

  const teamDisplayName =
    teamNameInput.trim() ||
    profiles.find((p: any) => p.id === user.id)?.team_name ||
    user?.email?.split('@')?.[0] ||
    'Tiimi';

  const getTeamDisplayNameByUid = (uid: string) => {
    const pr = profiles.find((p: any) => p.id === uid);
    return pr?.team_name || pr?.email?.split('@')?.[0] || 'Tiimi';
  };

  const getPickPoints = (pick: any) => {
    if (pick?.earned_points !== null && pick?.earned_points !== undefined) return Number(pick.earned_points) || 0;
    return Number(pick?.players?.points) || 0;
  };

  const activeTournamentNameForStats = activeTournament?.name || 'Aktiivinen kisa';
  const playerTournamentRows = buildPlayerTournamentRows(players);
  const playerSeasonRows = buildPlayerSeasonRows(history, players, activeTournamentNameForStats);

  const tournamentBoard = (() => {
    const totals = new Map<string, number>();
    const lineups = new Map<string, Array<{ playerName: string; points: number }>>();
    allTeamsPicks.forEach((pick: any) => {
      const uid = pick.user_id;
      if (!uid) return;
      const pts = getPickPoints(pick);
      totals.set(uid, (totals.get(uid) || 0) + pts);
      const playerName = pick.players?.name ?? '?';
      if (!lineups.has(uid)) lineups.set(uid, []);
      lineups.get(uid)!.push({ playerName, points: pts });
    });
    lineups.forEach((arr) => arr.sort((a, b) => b.points - a.points));
    return Array.from(totals.entries())
      .map(([uid, pts]) => ({
        uid,
        pts,
        name: getTeamDisplayNameByUid(uid),
        lineup: lineups.get(uid) ?? [],
      }))
      .sort((a, b) => b.pts - a.pts);
  })();

  const seasonBoard = (() => {
    /**
     * Kausi = arkistoidut kisat + tämänhetkisen kisan pisteet.
     * Avain: profiles.id (uuid), jotta nimen vaihto ei jaa pisteitä.
     * Vanhat rivit ilman user_id: legacy:team_name (sama kuin ennen migraatiota).
     */
    const LEGACY_PREFIX = 'legacy:';
    const stableKeyFromHistoryRow = (row: any) => {
      const uid = row.user_id as string | undefined;
      if (uid && typeof uid === 'string') return uid;
      return `${LEGACY_PREFIX}${row.team_name || 'Nimetön tiimi'}`;
    };

    const totals = new Map<string, number>();
    const pointsByTeamAndTournament = new Map<string, Map<string, number>>();
    const tournamentOrder: string[] = [];
    const seenTournaments = new Set<string>();

    const addTeamTournamentPts = (teamKey: string, tournamentName: string, pts: number) => {
      if (!pointsByTeamAndTournament.has(teamKey)) pointsByTeamAndTournament.set(teamKey, new Map());
      const m = pointsByTeamAndTournament.get(teamKey)!;
      m.set(tournamentName, (m.get(tournamentName) || 0) + pts);
      totals.set(teamKey, (totals.get(teamKey) || 0) + pts);
    };

    // 1) Arkistoidut kisat (history sisältää jo earned_points per pelaaja/tiimi)
    history.forEach((row: any) => {
      const teamKey = stableKeyFromHistoryRow(row);
      const tournamentName = row.tournament_name || 'Tuntematon turnaus';
      const pts = Number(row.earned_points) || 0;

      addTeamTournamentPts(teamKey, tournamentName, pts);

      if (!seenTournaments.has(tournamentName)) {
        seenTournaments.add(tournamentName);
        tournamentOrder.push(tournamentName);
      }
    });

    // 2) Tämänhetkinen aktiivinen kisa (allTeamsPicks = aktiivisen kisan picks)
    const activeTournamentName = activeTournament?.name || 'Aktiivinen kisa';
    if (!seenTournaments.has(activeTournamentName)) {
      seenTournaments.add(activeTournamentName);
      tournamentOrder.unshift(activeTournamentName);
    }

    allTeamsPicks.forEach((pick: any) => {
      const uid = pick.user_id;
      if (!uid) return;

      const pts = getPickPoints(pick);
      addTeamTournamentPts(uid, activeTournamentName, pts);
    });

    return Array.from(totals.entries())
      .map(([key, pts]) => {
        const m = pointsByTeamAndTournament.get(key) || new Map<string, number>();
        const tournamentLines = tournamentOrder
          .map((tName) => ({ tournamentName: tName, points: m.get(tName) || 0 }))
          .filter((line) => line.points !== 0);

        const isLegacy = key.startsWith(LEGACY_PREFIX);
        const name = isLegacy ? key.slice(LEGACY_PREFIX.length) : getTeamDisplayNameByUid(key);
        const uid = isLegacy ? undefined : key;

        return {
          uid,
          name,
          pts,
          tournamentLines,
        };
      })
      .sort((a, b) => b.pts - a.pts);
  })();

  const hallOfFameItems = (() => {
    const fallback = 'Ei dataa vielä';
    const revealMostPopular = Boolean(activeTournament?.is_locked);

    const currentTeamNameByUid = (uid: string) => {
      const pr = profiles.find((p: any) => p.id === uid);
      return pr?.team_name || pr?.email?.split('@')?.[0] || 'Tiimi';
    };

    /** Kauden MVP: paras yhden joukkueen tuoma pistemäärä (max yli joukkueiden), ei summaa kaikista joukkueista. */
    const LEGACY_HOF = 'legacy:';
    const displayTeamKeyHof = (teamKey: string) =>
      teamKey.startsWith(LEGACY_HOF) ? teamKey.slice(LEGACY_HOF.length) : currentTeamNameByUid(teamKey);
    const teamKeyFromHistoryRowHof = (row: any) => {
      const uid = row.user_id as string | undefined;
      if (uid && typeof uid === 'string') return uid;
      return `${LEGACY_HOF}${row.team_name || 'Nimetön tiimi'}`;
    };
    const ptsByTeamAndPlayer = new Map<string, Map<string, number>>();
    const addPtsHof = (teamKey: string, playerName: string, pts: number) => {
      if (!playerName?.trim() || !teamKey) return;
      if (!ptsByTeamAndPlayer.has(teamKey)) ptsByTeamAndPlayer.set(teamKey, new Map());
      const m = ptsByTeamAndPlayer.get(teamKey)!;
      m.set(playerName, (m.get(playerName) || 0) + pts);
    };
    history.forEach((row: any) => {
      const name = row.player_name;
      if (!name) return;
      addPtsHof(teamKeyFromHistoryRowHof(row), name, Number(row.earned_points) || 0);
    });
    allTeamsPicks.forEach((pick: any) => {
      const uid = pick.user_id;
      if (!uid) return;
      const name = pick.players?.name;
      if (!name) return;
      addPtsHof(uid, name, getPickPoints(pick));
    });
    const bestTeamForPlayer = new Map<string, { pts: number; teamKey: string }>();
    ptsByTeamAndPlayer.forEach((playerMap, teamKey) => {
      playerMap.forEach((pts, playerName) => {
        const cur = bestTeamForPlayer.get(playerName);
        if (
          !cur ||
          pts > cur.pts ||
          (pts === cur.pts && teamKey.localeCompare(cur.teamKey, 'fi') < 0)
        ) {
          bestTeamForPlayer.set(playerName, { pts, teamKey });
        }
      });
    });
    const mvpRanking = Array.from(bestTeamForPlayer.entries()).sort(
      (a, b) => b[1].pts - a[1].pts || a[0].localeCompare(b[0], 'fi')
    );
    const mvp = mvpRanking[0];
    const mvpExpandLines = mvpRanking.slice(1, 5).map(([name, { pts, teamKey }], idx) =>
      `${idx + 2}. ${name} (${pts} p) — ${displayTeamKeyHof(teamKey)}`
    );

    const valueByPlayer = new Map<string, { points: number; price: number }>();
    const getPlayerPriceByName = (name: string) => {
      const pl = players.find((p: any) => p.name === name);
      return pl ? getPrice(Number(pl.official_rating) || 950) : 0;
    };
    history.forEach((row: any) => {
      const name = row.player_name;
      if (!name) return;
      const pts = Number(row.earned_points) || 0;
      // Uudemmissa arkistoissa buy_price on tallessa, vanhoissa arvioidaan ratingista
      const price = Number(row.buy_price) || getPlayerPriceByName(name);
      const prev = valueByPlayer.get(name) || { points: 0, price: 0 };
      valueByPlayer.set(name, { points: prev.points + pts, price: prev.price + price });
    });
    allTeamsPicks.forEach((pick: any) => {
      const name = pick.players?.name;
      if (!name) return;
      const pts = getPickPoints(pick);
      const price = Number(pick.buy_price) || getPlayerPriceByName(name);
      const prev = valueByPlayer.get(name) || { points: 0, price: 0 };
      valueByPlayer.set(name, { points: prev.points + pts, price: prev.price + price });
    });
    const stealRanking = Array.from(valueByPlayer.entries())
      .filter(([, d]) => d.points > 0 && d.price > 0)
      .map(([name, d]) => ({
        name,
        ratio: d.points / d.price,
        points: d.points,
        price: d.price,
      }))
      .sort((a, b) => {
        // Vertaa pisteet/hinta ristitulolla (vakaampi kuin kahden ratio-erotus).
        const cross = b.points * a.price - a.points * b.price;
        if (cross !== 0) return cross;
        return a.name.localeCompare(b.name, 'fi');
      });
    const steal = stealRanking[0];
    const stealExpandLines = stealRanking.slice(1, 5).map(
      (row, idx) =>
        `${idx + 2}. ${row.name} (${formatMoneyFi(Math.round(row.price / row.points))}\u00A0€ / piste)`
    );

    const hotSorted = [...players]
      .filter((p: any) => (Number(p.hot_rounds) || 0) > 0)
      .sort((a, b) => (Number(b.hot_rounds) || 0) - (Number(a.hot_rounds) || 0));
    const hotHero = hotSorted[0];
    const hotExpandLines = hotSorted.slice(1, 5).map(
      (p: any, idx) => `${idx + 2}. ${p.name} (${p.hot_rounds} hot roundia)`
    );

    const hioSorted = [...players]
      .filter((p: any) => (Number(p.hio_count) || 0) > 0)
      .sort((a, b) => (Number(b.hio_count) || 0) - (Number(a.hio_count) || 0));
    const hioKing = hioSorted[0];
    const hioExpandLines = hioSorted.slice(1, 5).map(
      (p: any, idx) => `${idx + 2}. ${p.name} (${p.hio_count} hio)`
    );

    const popularity = new Map<string, Set<string>>();
    history.forEach((row: any) => {
      const playerName = row.player_name;
      if (!playerName) return;
      const managerKey = `${row.tournament_name || 'na'}::${row.team_name || row.manager_name || 'na'}`;
      if (!popularity.has(playerName)) popularity.set(playerName, new Set<string>());
      popularity.get(playerName)?.add(managerKey);
    });
    allTeamsPicks.forEach((pick: any) => {
      const playerName = pick.players?.name;
      if (!playerName) return;
      const managerKey = `${activeTournament?.name || 'aktiivinen'}::${currentTeamNameByUid(pick.user_id)}`;
      if (!popularity.has(playerName)) popularity.set(playerName, new Set<string>());
      popularity.get(playerName)?.add(managerKey);
    });
    const popSorted = Array.from(popularity.entries())
      .map(([name, managers]) => ({ name, count: managers.size }))
      .sort((a, b) => b.count - a.count);
    const mostPopular = popSorted[0];
    const popExpandLines =
      revealMostPopular && popSorted.length > 1
        ? popSorted.slice(1, 5).map((row, idx) => `${idx + 2}. ${row.name} (${row.count} manageria)`)
        : [];

    const managerTournamentPoints = new Map<string, number>();
    history.forEach((row: any) => {
      const tName = row.tournament_name || 'Tuntematon turnaus';
      const manager = row.team_name || row.manager_name || 'Tiimi';
      const key = `${tName}||${manager}`;
      managerTournamentPoints.set(key, (managerTournamentPoints.get(key) || 0) + (Number(row.earned_points) || 0));
    });
    const currentTournamentByManager = new Map<string, number>();
    allTeamsPicks.forEach((pick: any) => {
      const manager = currentTeamNameByUid(pick.user_id);
      currentTournamentByManager.set(manager, (currentTournamentByManager.get(manager) || 0) + getPickPoints(pick));
    });
    currentTournamentByManager.forEach((pts, manager) => {
      const key = `${activeTournament?.name || 'Aktiivinen kisa'}||${manager}`;
      managerTournamentPoints.set(key, (managerTournamentPoints.get(key) || 0) + pts);
    });
    const athSorted = Array.from(managerTournamentPoints.entries())
      .map(([key, pts]) => {
        const [tournamentName, managerName] = key.split('||');
        return { tournamentName, managerName, pts };
      })
      .sort((a, b) => b.pts - a.pts);
    const allTimeHigh = athSorted[0];
    const athExpandLines = athSorted.slice(1, 5).map(
      (row, idx) => `${idx + 2}. ${row.managerName} (${row.pts} p) — ${row.tournamentName}`
    );

    const tournamentPar = new Map<string, { sum: number; count: number }>();
    history.forEach((row: any) => {
      const tName = row.tournament_name || 'Tuntematon turnaus';
      const p = Number(row.player_score);
      if (Number.isNaN(p)) return;
      const prev = tournamentPar.get(tName) || { sum: 0, count: 0 };
      tournamentPar.set(tName, { sum: prev.sum + p, count: prev.count + 1 });
    });
    const hardestSorted = Array.from(tournamentPar.entries())
      .map(([name, d]) => ({
        name,
        avgPar: d.count ? d.sum / d.count : 0,
        count: d.count,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.avgPar - a.avgPar);
    const hardestCourse = hardestSorted[0];
    const hardestExpandLines = hardestSorted.slice(1, 5).map(
      (row, idx) => `${idx + 2}. ${row.name} (keski-par ${row.avgPar.toFixed(2)})`
    );

    const tournamentPoints = new Map<string, number>();
    history.forEach((row: any) => {
      const tName = row.tournament_name || 'Tuntematon turnaus';
      tournamentPoints.set(tName, (tournamentPoints.get(tName) || 0) + (Number(row.earned_points) || 0));
    });
    const currentTotalPoints = allTeamsPicks.reduce((acc: number, pick: any) => acc + getPickPoints(pick), 0);
    if (currentTotalPoints > 0) {
      tournamentPoints.set(activeTournament?.name || 'Aktiivinen kisa', (tournamentPoints.get(activeTournament?.name || 'Aktiivinen kisa') || 0) + currentTotalPoints);
    }
    const floodSorted = Array.from(tournamentPoints.entries()).sort((a, b) => b[1] - a[1]);
    const flood = floodSorted[0];
    const floodExpandLines = floodSorted.slice(1, 5).map(
      ([name, pts], idx) => `${idx + 2}. ${name} (${pts} p)`
    );

    return [
      {
        emoji: '🏆',
        title: 'Kauden MVP',
        value: mvp ? `${mvp[0]} (${mvp[1].pts} p)` : fallback,
        contextLine: mvp ? `Joukkue: ${displayTeamKeyHof(mvp[1].teamKey)}` : undefined,
        detail: 'Eniten pisteitä yhdelle joukkueelle (paras joukkuekohtainen tuotto kaudella)',
        expandLines: mvpExpandLines,
      },
      {
        emoji: '💎',
        title: 'Hinta-laatusuhde',
        value:
          steal && Number.isFinite(steal.ratio)
            ? `${steal.name} (${formatMoneyFi(Math.round(steal.price / steal.points))}\u00A0€ / piste)`
            : fallback,
        detail:
          'Pienin maksettu summa per ansaitsema fantasypiste (€/piste), koko kauden hankinnat ja pisteet. Matalampi luku on parempi — listassa 2–5 on kalliimpia per piste kuin ykkönen.',
        expandLines: stealExpandLines,
      },
      {
        emoji: '🔥',
        title: 'Hot round -sankari',
        value: hotHero && (Number(hotHero.hot_rounds) || 0) > 0 ? `${hotHero.name} (${hotHero.hot_rounds} hot roundia)` : fallback,
        detail: 'Eniten Hot Round -bonuksia',
        expandLines: hotExpandLines,
      },
      {
        emoji: '⛳',
        title: 'Holari-kuningas',
        value: hioKing && (Number(hioKing.hio_count) || 0) > 0 ? `${hioKing.name} (${hioKing.hio_count} hio)` : fallback,
        detail: 'Eniten HIO-merkintöjä',
        expandLines: hioExpandLines,
      },
      {
        emoji: '⭐',
        title: 'Suosituin valinta',
        value: revealMostPopular && mostPopular ? `${mostPopular.name} (${mostPopular.count} managerin joukkueessa)` : fallback,
        detail: revealMostPopular ? 'Useimmin managerien valitsema pelaaja' : 'Piilotettu kunnes kisa on lukittu',
        expandLines: popExpandLines,
      },
      {
        emoji: '🚀',
        title: 'Kovin turnaussaldo',
        value: allTimeHigh ? `${allTimeHigh.managerName} (${allTimeHigh.pts} p)` : fallback,
        contextLine: allTimeHigh ? `Turnaus: ${allTimeHigh.tournamentName}` : undefined,
        detail: 'Paras yksittäinen turnaustulos managerille',
        expandLines: athExpandLines,
      },
      {
        emoji: '🌪️',
        title: 'Vaikein rata',
        value: hardestCourse ? `${hardestCourse.name} (keski-par ${hardestCourse.avgPar.toFixed(2)})` : fallback,
        detail: 'Huonoin keskimääräinen par-tulos',
        expandLines: hardestExpandLines,
      },
      {
        emoji: '🌊',
        title: 'Pistetulva',
        value: flood ? `${flood[0]} (${flood[1]} p)` : fallback,
        detail: 'Turnaus, jossa jaettiin eniten pisteitä',
        expandLines: floodExpandLines,
      },
    ];
  })();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">
      <header className="bp-header bp-card mb-5 p-5 md:p-6">
        <div className="bp-header-inner flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="bp-header-logo-row">
            <div className="bp-header-logo-wrap">
              <Image
                src="/logo.png"
                alt="BogiPörssi"
                width={40}
                height={40}
                className="bp-header-logo"
                priority
              />
            </div>
            <div className="min-w-0 flex-1 bp-header-brand-text">
              <div className="bp-header-kicker">BogiPörssi 2026</div>
              <div className="bp-header-title-row mt-1">
                <h1 className="bp-header-title truncate">
                  {activeTournament?.name || 'Ei aktiivista turnasta'}
                </h1>
                {activeTournament?.is_locked && (
                  <span className="bp-locked-badge bp-locked-badge--header shrink-0">
                    Lukittu
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bp-header-actions w-full shrink-0 lg:max-w-xs">
            <div className="flex flex-col gap-2 lg:items-end">
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="bp-btn-logout"
              >
                <span className="bp-btn-text-stack">
                  <span>Ulos</span>
                  <span className="bp-btn-subtext bp-btn-subtext--logout">
                    Kirjaudu ulos sivulta
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bp-main-nav mb-6" aria-label="Päävalikko">
        <button
          onClick={() => setMainTab('market')}
          className={["bp-tab", mainTab === 'market' ? "bp-tab-active" : ""].join(" ")}
        >
          Pelaajatori
        </button>
        <button
          onClick={() => setMainTab('team')}
          className={["bp-tab", mainTab === 'team' ? "bp-tab-active" : ""].join(" ")}
        >
          Oma joukkue
        </button>
        <button
          onClick={() => setMainTab('results')}
          className={["bp-tab", mainTab === 'results' ? "bp-tab-active" : ""].join(" ")}
        >
          Tulokset
        </button>
        <button
          onClick={() => setMainTab('hall')}
          className={["bp-tab", mainTab === 'hall' ? "bp-tab-active" : ""].join(" ")}
        >
          Hall of Fame
        </button>
        <button
          onClick={() => setMainTab('rules')}
          className={["bp-tab", mainTab === 'rules' ? "bp-tab-active" : ""].join(" ")}
        >
          Säännöt
        </button>
        <button
          onClick={() => setMainTab('history')}
          className={["bp-tab", mainTab === 'history' ? "bp-tab-active" : ""].join(" ")}
        >
          Historiikki
        </button>
        {user.email === ADMIN_EMAIL && (
          <button
            onClick={() => setMainTab('admin')}
            className={["bp-tab", mainTab === 'admin' ? "bp-tab-active" : ""].join(" ")}
          >
            Admin
          </button>
        )}
      </nav>

      {user.email === ADMIN_EMAIL && mainTab === 'admin' && (
        <AdminPanel 
          activeTournament={activeTournament}
          updateTournamentName={updateTournamentName}
          updateTournamentRoundParStrokes={updateTournamentRoundParStrokes}
          players={players.filter(p => p.is_active)}
          adminSearch={adminSearch}
          setAdminSearch={setAdminSearch}
          handleRatingImport={handleRatingImport}
          importResultsFromCsvFile={importResultsFromCsvFile}
          startNewTournament={startNewTournament}
          toggleTournamentLock={toggleTournamentLock}
          saveAdminStats={saveAdminStats}
        />
      )}

      {mainTab === 'market' && (
        <PlayerMarket
          players={players.filter(p => p.is_active)}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          team={team}
          budget={BUDGET}
          isLocked={activeTournament?.is_locked}
          onSelect={selectPlayer}
          onRemove={removePlayer}
          getPrice={getPrice}
          teamLogoPath={teamLogoPath}
          teamLogoId={profiles.find((p: any) => p.id === user.id)?.team_logo_id ?? null}
          teamDisplayName={teamDisplayName}
        />
      )}

      {mainTab === 'team' && (
        <section className="pm-section">
          <div className="pm-card pm-card--stack bp-team-settings-card mb-2">
            <div className="pm-row-dense mb-3">
              <TeamLogo
                logoPath={teamLogoPath}
                logoId={profiles.find((p: any) => p.id === user.id)?.team_logo_id ?? null}
                fallbackName={teamDisplayName}
                size="md"
              />
              <div className="min-w-0">
                <h2 className="pm-title">{teamDisplayName}</h2>
                <p className="pm-sub">Muokkaa joukkueen nimeä ja logoa.</p>
              </div>
            </div>
            <div className="space-y-5">
              <div className="pt-1">
                <label htmlFor="team-name-input" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  Joukkueen nimi
                </label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="team-name-input"
                    type="text"
                    placeholder="Joukkueen nimi"
                    value={teamNameInput}
                    onChange={e => setTeamNameInput(e.target.value)}
                    className="bp-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => updateTeamName(teamNameInput)}
                    className="bp-btn-primary bp-btn-primary--stacked text-[13px] px-4"
                  >
                    <span className="bp-btn-text-stack">
                      <span>Tallenna</span>
                      <span className="bp-btn-subtext bp-btn-subtext--primary">
                        Tallentaa joukkueen nimen
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <div
                role="group"
                aria-labelledby="team-logo-heading"
                className="bp-team-logo-fieldset"
              >
                <h3 id="team-logo-heading" className="bp-team-logo-legend">
                  Joukkueen logo
                </h3>
                <p className="bp-team-logo-help">
                  Lataa oma kuva (PNG, JPEG, WebP tai GIF, enintään 2 Mt). Näkyy pelaajatorilla, tuloksissa ja omassa joukkueessa.
                </p>
                <input
                  ref={teamLogoFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  id="team-logo-file"
                  onChange={onTeamLogoFileChange}
                />
                {(teamLogoPath || parseTeamLogoId(profiles.find((p: any) => p.id === user.id)?.team_logo_id)) && (
                  <div className="bp-team-logo-preview mb-2">
                    <TeamLogo
                      logoPath={teamLogoPath}
                      logoId={profiles.find((p: any) => p.id === user.id)?.team_logo_id ?? null}
                      fallbackName={teamDisplayName}
                      size="md"
                      className="bp-team-logo-preview-img"
                    />
                    <span className="bp-team-logo-preview-name min-w-0 flex-1 truncate">
                      {teamDisplayName}
                    </span>
                  </div>
                )}
                <div className="bp-team-logo-actions">
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => teamLogoFileRef.current?.click()}
                    className="bp-btn-primary text-[14px] py-3 px-3"
                  >
                    {uploadingLogo ? 'Lähetetään…' : 'Valitse kuva'}
                  </button>
                  <button
                    type="button"
                    disabled={!teamLogoPath || uploadingLogo}
                    onClick={() => removeTeamLogo()}
                    className="bp-btn-danger text-[14px] py-3 px-3"
                  >
                    Poista logo
                  </button>
                </div>
              </div>
            </div>
          </div>

          <UserTeam
            team={team}
            isLocked={activeTournament?.is_locked}
            onRemove={removePlayer}
            getPrice={getPrice}
            teamDisplayName={teamDisplayName}
            teamLogoPath={teamLogoPath}
            teamLogoId={profiles.find((p: any) => p.id === user.id)?.team_logo_id ?? null}
          />
        </section>
      )}

      {mainTab === 'results' && (
        <section className="pm-section grid gap-6">
          <Leaderboards
            tab={leaderboardTab}
            setTab={setLeaderboardTab}
            boardMode={resultsBoard}
            setBoardMode={setResultsBoard}
            playerTournamentRows={playerTournamentRows}
            playerSeasonRows={playerSeasonRows}
            activeBoard={leaderboardTab === 'tournament' ? tournamentBoard : seasonBoard}
            profiles={profiles}
            isLocked={!!activeTournament?.is_locked}
            viewerUserId={user.id}
            allTeamsPicks={allTeamsPicks}
            players={players}
            getPrice={getPrice}
            getPickPoints={getPickPoints}
          />
        </section>
      )}

      {mainTab === 'hall' && (
        <HallOfFame items={hallOfFameItems} />
      )}

      {mainTab === 'rules' && (
        <section className="pm-section">
          <div className="pm-toolbar">
            <div>
              <h2 className="pm-title">Pelinsäännöt</h2>
              <p className="pm-sub">Kilpailun säännöt ja pisteytys.</p>
            </div>
          </div>

          <div className="pm-grid">
            <div className="col-span-full">
              <div className="space-y-4">
                <article className="pm-card pm-card--stack">
                  <div className="pm-row-dense">
                    <span className="pm-avatar" aria-hidden>
                      👥
                    </span>
                    <h3 className="pm-name">Joukkueen rakenne</h3>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/70 list-disc pl-5">
                    <li>Jokaiseen kilpailuun valitaan 5 heittäjää per joukkue.</li>
                    <li>Kaikkien valittujen pelaajien tulokset lasketaan mukaan joukkueen kokonaispisteisiin.</li>
                  </ul>
                </article>

                <article className="pm-card pm-card--stack">
                  <div className="pm-row-dense">
                    <span className="pm-avatar" aria-hidden>
                      🎯
                    </span>
                    <h3 className="pm-name">Heittokohtainen pisteytys</h3>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/70 list-disc pl-5">
                    <li>
                      <span className="font-extrabold text-white/90">Miinusheitot (-):</span> Jokainen heitto alle parin tuo 2 pistettä.
                      (Esim. Birdie = 2p, Eagle = 4p).
                    </li>
                    <li>
                      <span className="font-extrabold text-white/90">Plusheitot (+):</span> Jokainen heitto yli parin tuo -1 pistettä.
                      (Esim. Bogey = -1p, Tuplabogey = -2p).
                    </li>
                  </ul>
                </article>

                <article className="pm-card pm-card--stack">
                  <div className="pm-row-dense">
                    <span className="pm-avatar" aria-hidden>
                      ⛳
                    </span>
                    <h3 className="pm-name">Kierros- ja suorituspisteet</h3>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/70 list-disc pl-5">
                    <li>
                      <span className="font-extrabold text-white/90">Pelikierrokset:</span> Jokainen pelattu kierros tuo 2 pistettä. (Esim.
                      cutista selviäminen kerryttää pistepottia).
                    </li>
                    <li>
                      <span className="font-extrabold text-white/90">Hot Round:</span> Kierroksen parhaasta tuloksesta palkitaan 5 pisteellä.
                    </li>
                    <li>
                      <span className="font-extrabold text-white/90">Hole-in-One:</span> Holarista pelaaja kuittaa 30 pistettä.
                    </li>
                  </ul>
                </article>

                <article className="pm-card pm-card--stack">
                  <div className="pm-row-dense">
                    <span className="pm-avatar" aria-hidden>
                      🏆
                    </span>
                    <h3 className="pm-name">Sijoitusbonukset</h3>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/70 list-disc pl-5">
                    <li>1. sija: 10 pistettä</li>
                    <li>2.–3. sijat: 5 pistettä</li>
                    <li>4.–10. sijat: 2 pistettä</li>
                  </ul>
                </article>
              </div>
            </div>
          </div>
        </section>
      )}

      {mainTab === 'history' && (
        <section className="pm-section">
          <div className="pm-toolbar">
            <div>
              <h2 className="pm-title">Kisa-arkisto</h2>
              <p className="pm-sub">Aiemmat turnaukset ja tiimien tulokset.</p>
            </div>
          </div>

          <div className="pm-grid">
            {history.length === 0 && (
              <div className="col-span-full rounded-[10px] border border-dashed border-white/15 bg-white/[0.03] p-5 text-center text-sm text-white/55 backdrop-blur">
                Historiikissa ei ole vielä turnauksia. Kun aloitat uuden kisan administa, nykyinen kisa arkistoidaan tänne.
              </div>
            )}

            {history.length > 0 &&
              Array.from(new Set(history.map(h => h.tournament_name)))
                .reverse()
                .map(tName => {
                  const tournamentRows = history.filter(h => h.tournament_name === tName);
                  const teamTotals = Array.from(new Set(tournamentRows.map(h => h.team_name)))
                    .map(t => {
                      const rows = tournamentRows.filter(r => r.team_name === t);
                      const score = rows.reduce((acc, curr) => {
                        const par = Number(curr.player_score) || 0;
                        const pts = (par < 0 ? Math.abs(par) * 2 : par * -1) + (Number(curr.player_rounds) * 2);
                        return acc + (curr.earned_points ?? pts);
                      }, 0);
                      return { name: t, total: score };
                    })
                    .sort((a, b) => b.total - a.total);

                  const winner = teamTotals[0];

                  return (
                    <details
                      key={tName}
                      className="group col-span-full overflow-hidden rounded-[10px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] shadow-[0_2px_12px_rgba(0,0,0,0.3)] backdrop-blur"
                    >
                      <summary className="cursor-pointer select-none list-none px-3 py-3 [&::-webkit-details-marker]:hidden sm:px-4 sm:py-3.5">
                        <div className="pm-row-dense">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-400/35 bg-amber-500/12 text-sm leading-none"
                            aria-hidden
                          >
                            🏆
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="pm-name" title={tName}>
                              {tName}
                            </h3>
                            <p className="pm-sub !mt-0.5">{teamTotals.length} tiimiä</p>
                          </div>
                          <div className="pm-nums shrink-0">
                            <span className="pm-tag pm-tag-price max-w-[10rem]">
                              <span className="pm-tag-label pm-tag-label-price">Voittaja</span>
                              <span className="pm-tag-value pm-tag-value-price truncate" title={winner?.name}>
                                {winner?.name ?? '—'}
                              </span>
                            </span>
                            <span className="pm-tag pm-tag-points">
                              <span className="pm-tag-label pm-tag-label-points">Pisteet</span>
                              <span className="pm-tag-value pm-tag-value-points">{winner?.total ?? 0} p</span>
                            </span>
                          </div>
                        </div>
                      </summary>

                      <div className="border-t border-white/10 bg-black/25 p-3 sm:p-4">
                        <div className="pm-grid">
                          {teamTotals.map((team, index) => (
                            <article
                              key={team.name}
                              className={[
                                'pm-card pm-card--stack',
                                index === 0 ? '!border-l-emerald-400 !bg-emerald-500/[0.1]' : '',
                              ].join(' ')}
                            >
                              <div className="pm-row-dense">
                                <TeamLogo
                                  logoPath={profiles.find((p: any) => p.team_name === team.name)?.team_logo_path}
                                  logoId={profiles.find((p: any) => p.team_name === team.name)?.team_logo_id}
                                  fallbackName={team.name}
                                  size="md"
                                />
                                <h3 className="pm-name" title={team.name}>
                                  {team.name}
                                </h3>
                                <div className="pm-nums">
                                  <span className="pm-tag pm-tag-rating">
                                    <span className="pm-tag-label">Sija</span>
                                    <span className="pm-tag-value">{index + 1}</span>
                                  </span>
                                  <span className="pm-tag pm-tag-points">
                                    <span className="pm-tag-label pm-tag-label-points">Yhteensä</span>
                                    <span className="pm-tag-value pm-tag-value-points">{team.total} p</span>
                                  </span>
                                </div>
                              </div>
                              {index === 0 && (
                                <div className="mt-2 inline-flex items-center rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-100">
                                  Voittaja
                                </div>
                              )}

                              <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2">
                                {tournamentRows
                                  .filter(r => r.team_name === team.name)
                                  .map((r, i) => {
                                    const p = Number(r.player_score) || 0;
                                    const pts = (p < 0 ? Math.abs(p) * 2 : p * -1) + (Number(r.player_rounds) * 2);
                                    const earned = r.earned_points ?? pts;
                                    return (
                                      <div
                                        key={i}
                                        className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
                                      >
                                        <div className="pm-row-dense">
                                          <div className="pm-avatar pm-avatar--sm" aria-hidden>
                                            {initials(r.player_name || '?')}
                                          </div>
                                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/90">
                                            {r.player_name}
                                          </span>
                                          <div className="pm-nums">
                                            <span className="pm-tag pm-tag-points">
                                              <span className="pm-tag-label pm-tag-label-points">Pisteet</span>
                                              <span className="pm-tag-value pm-tag-value-points">{earned} p</span>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    </details>
                  );
                })}
          </div>
        </section>
      )}
    </main>
  );
}