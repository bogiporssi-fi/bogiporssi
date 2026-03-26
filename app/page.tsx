"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import AdminPanel from './components/AdminPanel';
import PlayerMarket from './components/PlayerMarket';
import UserTeam from './components/UserTeam';
import Leaderboards from './components/Leaderboards';
import HallOfFame from './components/HallOfFame';
import TeamLogo from './components/TeamLogo';
import { parseTeamLogoId } from '../lib/teamLogos';

// ADMIN-TUNNUS
const ADMIN_EMAIL = 'kimmo@gmail.com';

// HINNOITTELUKAAVA: (Rating - 950) * 2600
const getPrice = (rating: number) => {
  const diff = rating - 950;
  return diff > 0 ? diff * 2600 : 0;
};

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
  const [mainTab, setMainTab] = useState<'market' | 'team' | 'results' | 'hall' | 'history' | 'admin'>('market');
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadData();
      } else {
        // Jos käyttäjää ei ole kirjautuneena, ei koskaan käynnistetä loadData():a.
        // Siksi laitetaan loading=false, ettei jää jumiin “Ladataan BogiPörssiä…”.
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadData();
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
      const { data: { session } } = await supabase.auth.getSession();
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
            const pts = (par < 0 ? Math.abs(par) * 2 : par * -1) + (Number(player.rounds_played) * 2) + (Number(player.hot_rounds) * 5) + (Number(player.hio_count) * 10) + (Number(player.position_bonus) || 0);

            archiveData.push({
              tournament_name: kisanNimi, // Käytetään oikeaa nimeä
              manager_name: profile.full_name || 'Tuntematon',
              team_name: profile.team_name || 'Nimetön tiimi',
              player_name: player.name,
              player_score: player.par_score,
              player_rounds: player.rounds_played,
              earned_points: pts,
              buy_price: pick.buy_price ?? null
            });
          }
        });
        if (archiveData.length > 0) {
          const { error: archiveErr } = await supabase.from('tournament_results').insert(archiveData);
          // Jos buy_price-sarake ei ole vielä tietokannassa, tiputetaan kenttä ja yritetään uudestaan.
          if (archiveErr) {
            const msg = archiveErr.message || '';
            const maybeMissingColumn =
              msg.toLowerCase().includes('buy_price') &&
              (msg.toLowerCase().includes('column') || msg.toLowerCase().includes('schema') || msg.toLowerCase().includes('not exist'));

            if (maybeMissingColumn) {
              const withoutBuyPrice = archiveData.map(({ buy_price, ...rest }) => rest);
              const { error: retryErr } = await supabase.from('tournament_results').insert(withoutBuyPrice);
              if (retryErr) throw retryErr;
            } else {
              throw archiveErr;
            }
          }
        }
      }

      // Nollataan pelaajien tiedot ja poistetaan valinnat
      await supabase.from('players').update({ points: 0, par_score: 0, rounds_played: 0, hot_rounds: 0, hio_count: 0, position_bonus: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
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

  async function saveAdminStats(pId: string, par: number, rounds: number, hot: number, hio: number, pos: number, newRat: number) {
    let scorePoints = par < 0 ? (Math.abs(par) * 2) : (par * -1);
    const finalPoints = scorePoints + (rounds * 2) + (hot * 5) + (hio * 10) + pos;
    await supabase.from('players').update({ par_score: par, rounds_played: rounds, hot_rounds: hot, hio_count: hio, position_bonus: pos, points: finalPoints, official_rating: newRat }).eq('id', pId);
    if (activeTournament?.id) {
      await supabase.from('picks').update({ earned_points: finalPoints }).eq('player_id', pId).eq('tournament_id', activeTournament.id);
    }
    loadData();
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
    /** Kausi = kaikkien arkistoitujen kisojen pisteet tiimin nimellä + tämänhetkisen kisan pisteet (ei duplikaattia, kun kisa arkistoidaan historiaan). */
    const totals = new Map<string, number>();
    const playerPointsByTeam = new Map<string, Map<string, number>>();

    const addPlayerPts = (teamName: string, playerName: string, pts: number) => {
      if (!playerPointsByTeam.has(teamName)) playerPointsByTeam.set(teamName, new Map());
      const m = playerPointsByTeam.get(teamName)!;
      const p = playerName || '?';
      m.set(p, (m.get(p) || 0) + pts);
    };

    history.forEach((row: any) => {
      const teamName = row.team_name || 'Nimetön tiimi';
      const pts = Number(row.earned_points) || 0;
      totals.set(teamName, (totals.get(teamName) || 0) + pts);
      addPlayerPts(teamName, row.player_name || '?', pts);
    });

    allTeamsPicks.forEach((pick: any) => {
      const uid = pick.user_id;
      if (!uid) return;
      const pts = getPickPoints(pick);
      const teamName = getTeamDisplayNameByUid(uid);
      totals.set(teamName, (totals.get(teamName) || 0) + pts);
      addPlayerPts(teamName, pick.players?.name, pts);
    });

    return Array.from(totals.entries())
      .map(([name, pts]) => ({
        name,
        pts,
        lineup: Array.from((playerPointsByTeam.get(name) || new Map()).entries())
          .map(([playerName, p]) => ({ playerName, points: p }))
          .sort((a, b) => b.points - a.points),
      }))
      .sort((a, b) => b.pts - a.pts);
  })();

  const hallOfFameItems = (() => {
    const fallback = 'Ei dataa vielä';

    const currentTeamNameByUid = (uid: string) => {
      const pr = profiles.find((p: any) => p.id === uid);
      return pr?.team_name || pr?.email?.split('@')?.[0] || 'Tiimi';
    };

    const pointsByPlayer = new Map<string, number>();
    history.forEach((row: any) => {
      const name = row.player_name;
      if (!name) return;
      pointsByPlayer.set(name, (pointsByPlayer.get(name) || 0) + (Number(row.earned_points) || 0));
    });
    allTeamsPicks.forEach((pick: any) => {
      const name = pick.players?.name;
      if (!name) return;
      pointsByPlayer.set(name, (pointsByPlayer.get(name) || 0) + getPickPoints(pick));
    });
    const mvp = Array.from(pointsByPlayer.entries()).sort((a, b) => b[1] - a[1])[0];

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
    const steal = Array.from(valueByPlayer.entries())
      .map(([name, d]) => ({ name, ratio: d.price > 0 ? d.points / d.price : -Infinity }))
      .sort((a, b) => b.ratio - a.ratio)[0];

    const hotHero = [...players].sort((a, b) => (Number(b.hot_rounds) || 0) - (Number(a.hot_rounds) || 0))[0];
    const hioKing = [...players].sort((a, b) => (Number(b.hio_count) || 0) - (Number(a.hio_count) || 0))[0];

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
    const mostPopular = Array.from(popularity.entries())
      .map(([name, managers]) => ({ name, count: managers.size }))
      .sort((a, b) => b.count - a.count)[0];

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
    const allTimeHigh = Array.from(managerTournamentPoints.entries())
      .map(([key, pts]) => {
        const [tournamentName, managerName] = key.split('||');
        return { tournamentName, managerName, pts };
      })
      .sort((a, b) => b.pts - a.pts)[0];

    const tournamentPar = new Map<string, { sum: number; count: number }>();
    history.forEach((row: any) => {
      const tName = row.tournament_name || 'Tuntematon turnaus';
      const p = Number(row.player_score);
      if (Number.isNaN(p)) return;
      const prev = tournamentPar.get(tName) || { sum: 0, count: 0 };
      tournamentPar.set(tName, { sum: prev.sum + p, count: prev.count + 1 });
    });
    const hardestCourse = Array.from(tournamentPar.entries())
      .map(([name, d]) => ({ name, avgPar: d.count ? d.sum / d.count : 0 }))
      .sort((a, b) => b.avgPar - a.avgPar)[0];

    const tournamentPoints = new Map<string, number>();
    history.forEach((row: any) => {
      const tName = row.tournament_name || 'Tuntematon turnaus';
      tournamentPoints.set(tName, (tournamentPoints.get(tName) || 0) + (Number(row.earned_points) || 0));
    });
    const currentTotalPoints = allTeamsPicks.reduce((acc: number, pick: any) => acc + getPickPoints(pick), 0);
    if (currentTotalPoints > 0) {
      tournamentPoints.set(activeTournament?.name || 'Aktiivinen kisa', (tournamentPoints.get(activeTournament?.name || 'Aktiivinen kisa') || 0) + currentTotalPoints);
    }
    const flood = Array.from(tournamentPoints.entries()).sort((a, b) => b[1] - a[1])[0];

    return [
      {
        emoji: '🏆',
        title: 'Kauden MVP',
        value: mvp ? `${mvp[0]} (${mvp[1]} p)` : fallback,
        detail: 'Eniten kokonaispisteitä kerännyt pelaaja',
      },
      {
        emoji: '💎',
        title: 'Hinta-laatusuhde',
        value: steal && Number.isFinite(steal.ratio) ? `${steal.name} (${steal.ratio.toFixed(4)} p / €)` : fallback,
        detail: 'Pisteet suhteessa hankintahintaan',
      },
      {
        emoji: '🔥',
        title: 'Hot round -sankari',
        value: hotHero && (Number(hotHero.hot_rounds) || 0) > 0 ? `${hotHero.name} (${hotHero.hot_rounds} hot roundia)` : fallback,
        detail: 'Eniten Hot Round -bonuksia',
      },
      {
        emoji: '⛳',
        title: 'Holari-kuningas',
        value: hioKing && (Number(hioKing.hio_count) || 0) > 0 ? `${hioKing.name} (${hioKing.hio_count} hio)` : fallback,
        detail: 'Eniten HIO-merkintöjä',
      },
      {
        emoji: '⭐',
        title: 'Suosituin valinta',
        value: mostPopular ? `${mostPopular.name} (${mostPopular.count} managerin joukkueessa)` : fallback,
        detail: 'Useimmin managerien valitsema pelaaja',
      },
      {
        emoji: '🚀',
        title: 'Kovin turnaussaldo',
        value: allTimeHigh ? `${allTimeHigh.managerName} (${allTimeHigh.pts} p)` : fallback,
        detail: allTimeHigh ? `Turnaus: ${allTimeHigh.tournamentName}` : 'Paras yksittäinen turnaustulos managerille',
      },
      {
        emoji: '🌪️',
        title: 'Vaikein rata',
        value: hardestCourse ? `${hardestCourse.name} (keski-par ${hardestCourse.avgPar.toFixed(2)})` : fallback,
        detail: 'Huonoin keskimääräinen par-tulos',
      },
      {
        emoji: '🌊',
        title: 'Pistetulva',
        value: flood ? `${flood[0]} (${flood[1]} p)` : fallback,
        detail: 'Turnaus, jossa jaettiin eniten pisteitä',
      },
    ];
  })();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">
      <header className="bp-header bp-card mb-5 p-5 md:p-6">
        <div className="bp-header-inner flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="bp-header-logo-wrap">
              <Image
                src="/logo.svg"
                alt="BogiPörssi"
                width={40}
                height={40}
                className="bp-header-logo"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="bp-header-kicker">BogiPörssi 2026</div>
              <div className="bp-header-title-row mt-1">
                <h1 className="bp-header-title truncate">
                  {activeTournament?.name || 'Ei aktiivista turnasta'}
                </h1>
                {activeTournament?.is_locked && (
                  <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-200/95 backdrop-blur">
                    Lukittu
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bp-header-actions w-full shrink-0 lg:max-w-md">
            <div className="min-w-0 flex-1 space-y-3 lg:min-w-[220px]">
              <label htmlFor="team-name-input" className="sr-only">
                Joukkueen nimi
              </label>
              <input
                id="team-name-input"
                type="text"
                placeholder="Joukkueen nimi"
                value={teamNameInput}
                onChange={e => setTeamNameInput(e.target.value)}
                className="bp-input"
              />
              {/* Mobiili: napit heti inputin alle (ennen logon valintaa) */}
              <div className="flex flex-col gap-2 lg:hidden">
                <button type="button" onClick={() => updateTeamName(teamNameInput)} className="bp-btn-primary">
                  <span className="bp-btn-text-stack">
                    <span>Tallenna</span>
                    <span className="bp-btn-subtext bp-btn-subtext--primary">
                      Tallentaa joukkueen nimen
                    </span>
                  </span>
                </button>
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

              {(teamLogoPath || parseTeamLogoId(profiles.find((p: any) => p.id === user.id)?.team_logo_id)) && (
                <div className="bp-team-logo-preview">
                  <TeamLogo
                    logoPath={teamLogoPath}
                    logoId={profiles.find((p: any) => p.id === user.id)?.team_logo_id ?? null}
                    fallbackName={teamDisplayName}
                    size="md"
                    className="bp-team-logo-preview-img"
                  />
                  <span className="bp-team-logo-preview-name min-w-0 flex-1 truncate">{teamDisplayName}</span>
                </div>
              )}
              <fieldset className="bp-team-logo-fieldset">
                <legend className="bp-team-logo-legend">Joukkueen logo</legend>
                <p className="mb-2 text-[11px] leading-snug text-white/45">
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => teamLogoFileRef.current?.click()}
                    className="bp-btn-primary shrink-0 text-[13px] py-2 px-3"
                  >
                    {uploadingLogo ? 'Lähetetään…' : 'Valitse kuva'}
                  </button>
                  <button
                    type="button"
                    disabled={!teamLogoPath || uploadingLogo}
                    onClick={() => removeTeamLogo()}
                    className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] font-semibold text-white/70 hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-35"
                  >
                    Poista logo
                  </button>
                </div>
              </fieldset>
            </div>
            {/* Desktop: napit oikealla kuten aiemmin */}
            <div className="flex shrink-0 gap-2 hidden lg:flex">
              <button type="button" onClick={() => updateTeamName(teamNameInput)} className="bp-btn-primary">
                <span className="bp-btn-text-stack">
                  <span>Tallenna</span>
                  <span className="bp-btn-subtext bp-btn-subtext--primary">
                    Tallentaa joukkueen nimen
                  </span>
                </span>
              </button>
              <button type="button" onClick={() => supabase.auth.signOut()} className="bp-btn-logout">
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
          players={players.filter(p => p.is_active)}
          adminSearch={adminSearch}
          setAdminSearch={setAdminSearch}
          handleRatingImport={handleRatingImport}
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