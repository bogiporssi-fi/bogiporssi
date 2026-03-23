"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// !!! VAIHDA TÄMÄ OMALSI !!!
const ADMIN_EMAIL = 'kimmo@gmail.com'

// LASKUKAAVA: (Rating - 950) * 2600
const getPrice = (rating: number) => {
  const diff = rating - 950;
  return diff > 0 ? diff * 2600 : 0;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeTournament, setActiveTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const BUDGET = 1000000; 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      loadData();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      loadData();
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: t } = await supabase.from('tournaments').select('*').eq('is_active', true).single();
    if (t) setActiveTournament(t);

    const { data: p } = await supabase.from('players').select('*');
    if (p) setPlayers(p);

    const { data: profs } = await supabase.from('profiles').select('*');
    if (profs) setProfiles(profs);

    const { data: picks } = await supabase.from('picks')
      .select(`user_id, player_id, tournament_id, players (name, official_rating, points)`)
      .eq('tournament_id', t?.id);

    if (picks) {
      const session = await supabase.auth.getSession();
      const myId = session.data.session?.user.id;
      setTeam(picks.filter((p: any) => p.user_id === myId));

      const scores: any = {};
      picks.forEach((p: any) => {
        scores[p.user_id] = (scores[p.user_id] || 0) + (p.players?.points || 0);
      });

      const board = Object.entries(scores).map(([uid, pts]) => ({ uid, pts: pts as number }));
      setLeaderboard(board.sort((a: any, b: any) => b.pts - a.pts));
    }
    setLoading(false);
  }

  async function saveAdminStats(pId: string, par: number, rounds: number, hot: number, hio: number, pos: number, newRat: number) {
    let scorePoints = par < 0 ? (par * -2) : (par * -1);
    const finalPoints = scorePoints + (rounds * 2) + (hot * 5) + (hio * 10) + pos;
    await supabase.from('players').update({ 
      par_score: par, rounds_played: rounds, hot_rounds: hot,
      hio_count: hio, position_bonus: pos, points: finalPoints,
      official_rating: newRat 
    }).eq('id', pId);
    loadData();
  }

  const calculateTeamCost = (teamPicks: any[]) => {
    return teamPicks.reduce((acc, curr) => acc + getPrice(curr.players?.official_rating || 950), 0);
  };

  async function selectPlayer(pId: string, rating: number) {
    if (team.length >= 5) return alert("Tiimi on täynnä!");
    const currentCost = calculateTeamCost(team);
    if (currentCost + getPrice(rating) > BUDGET) return alert("Budjetti ei riitä!");
    await supabase.from('picks').insert([{ player_id: pId, user_id: user.id, tournament_id: activeTournament.id }]);
    loadData();
  }

  async function removePlayer(pId: string) {
    await supabase.from('picks').delete().eq('player_id', pId).eq('user_id', user.id).eq('tournament_id', activeTournament?.id);
    loadData();
  }

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  if (loading && !user) return <div style={{ padding: '50px', textAlign: 'center' }}>Ladataan...</div>;

  if (!user) return (
    <main style={{ padding: '40px', textAlign: 'center', background: '#111', minHeight: '100vh', color: 'white' }}>
      <h1>BogiPörssi 2026</h1>
      <div style={{ maxWidth: '350px', margin: '0 auto', background: '#222', padding: '25px', borderRadius: '15px' }}>
        <input type="email" placeholder="Sähköposti" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px' }} />
        <input type="password" placeholder="Salasana" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '5px' }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '5px' }}>Kirjaudu</button>
      </div>
    </main>
  );

  const teamCost = calculateTeamCost(team);
  const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: '#fff', padding: '20px', borderRadius: '15px' }}>
        <div>
          <h2 style={{ margin: 0 }}>{activeTournament?.name || 'Turnaus'}</h2>
          <span style={{ color: '#0070f3', fontWeight: 'bold' }}>BogiPörssi</span>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ background: '#eee', border: 'none', padding: '10px 15px', borderRadius: '10px' }}>Ulos</button>
      </header>

      {/* ADMIN */}
      {user.email === ADMIN_EMAIL && (
        <section style={{ background: '#111', color: 'white', padding: '20px', borderRadius: '15px', marginBottom: '30px' }}>
          <h3>Admin-hallinta</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.8rem' }}>
              <thead>
                <tr><th>Nimi</th><th>Rating</th><th>Tul</th><th>Krs</th><th>Hot</th><th>HIO</th><th>Bon</th><th></th></tr>
              </thead>
              <tbody>
                {players.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><input id={`rat-${p.id}`} defaultValue={p.official_rating} style={{ width: '45px' }} /></td>
                    <td><input id={`par-${p.id}`} defaultValue={p.par_score} style={{ width: '35px' }} /></td>
                    <td><input id={`rnd-${p.id}`} defaultValue={p.rounds_played} style={{ width: '30px' }} /></td>
                    <td><input id={`hot-${p.id}`} defaultValue={p.hot_rounds} style={{ width: '30px' }} /></td>
                    <td><input id={`hio-${p.id}`} defaultValue={p.hio_count} style={{ width: '30px' }} /></td>
                    <td><select id={`pos-${p.id}`} defaultValue={p.position_bonus}><option value="0">-</option><option value="10">1.</option><option value="5">2-3.</option><option value="2">Top10</option></select></td>
                    <td><button onClick={() => {
                        const r = parseInt((document.getElementById(`rat-${p.id}`) as HTMLInputElement).value);
                        const pa = parseInt((document.getElementById(`par-${p.id}`) as HTMLInputElement).value);
                        const rn = parseInt((document.getElementById(`rnd-${p.id}`) as HTMLInputElement).value);
                        const ho = parseInt((document.getElementById(`hot-${p.id}`) as HTMLInputElement).value);
                        const hi = parseInt((document.getElementById(`hio-${p.id}`) as HTMLInputElement).value);
                        const po = parseInt((document.getElementById(`pos-${p.id}`) as HTMLSelectElement).value);
                        saveAdminStats(p.id, pa, rn, ho, hi, po, r);
                      }}>OK</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px' }}>
        
        {/* TORI */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Pelaajatori</h3>
            <input type="text" placeholder="Etsi pelaajaa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #ddd' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {filteredPlayers.sort((a,b) => b.official_rating - a.official_rating).map(p => (
              <div key={p.id} style={{ background: 'white', padding: '15px', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                  <div style={{ fontSize: '0.9rem', color: '#0070f3', fontWeight: 'bold' }}>Rating: {p.official_rating}</div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>#{p.pdga_number} | {p.hometown}</div>
                  <div style={{ fontWeight: 'bold', marginTop: '5px', fontSize: '1.1rem' }}>{getPrice(p.official_rating).toLocaleString()} €</div>
                </div>
                <button onClick={() => selectPlayer(p.id, p.official_rating)} disabled={team.some(t => t.player_id === p.id)} style={{ background: team.some(t => t.player_id === p.id) ? '#eee' : '#0070f3', color: team.some(t => t.player_id === p.id) ? '#aaa' : 'white', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer' }}>
                  {team.some(t => t.player_id === p.id) ? 'Valittu' : 'Osta'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* JOUKKUE */}
        <aside>
          <div style={{ background: 'white', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', position: 'sticky', top: '20px' }}>
            <h3 style={{ marginTop: 0 }}>Joukkueesi</h3>
            <div style={{ marginBottom: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Budjetti käytetty:</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: teamCost > BUDGET ? 'red' : '#1a1a1a' }}>{teamCost.toLocaleString()} / 1 000 000 €</div>
              <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((teamCost/BUDGET)*100, 100)}%`, height: '100%', background: teamCost > BUDGET ? 'red' : '#0070f3' }}></div>
              </div>
            </div>
            {team.map((pick: any) => (
              <div key={pick.player_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{pick.players?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>Rating: {pick.players?.official_rating}</div>
                </div>
                <button onClick={() => removePlayer(pick.player_id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
              </div>
            ))}
            {team.length === 0 && <p style={{ textAlign: 'center', color: '#999', margin: '20px 0' }}>Tiimi on tyhjä.</p>}
          </div>

          <div style={{ background: '#1a1a1a', color: 'white', padding: '20px', borderRadius: '20px', marginTop: '20px' }}>
            <h3 style={{ marginTop: 0 }}>Pistetilanne</h3>
            {leaderboard.map((entry, idx) => (
              <div key={entry.uid} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #333' }}>
                <span>{idx + 1}. {profiles.find(p => p.id === entry.uid)?.email.split('@')[0]}</span>
                <span style={{ fontWeight: 'bold' }}>{entry.pts} p</span>
              </div>
            ))}
          </div>
        </aside>

      </div>
    </main>
  );
}