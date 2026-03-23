"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    // 1. Haetaan kaikki pelaajat
    const { data: allPlayers } = await supabase.from('players').select('*');
    if (allPlayers) setPlayers(allPlayers);

    // 2. Haetaan kaikki valinnat (mukaan lukien id ja user_id)
    const { data: allPicks } = await supabase
      .from('picks')
      .select(`id, user_id, player_id, players (name, price, points)`);
    
    if (allPicks) {
      const session = await supabase.auth.getSession();
      const myId = session.data.session?.user.id;
      
      // Omat valinnat joukkue-näkymään
      setTeam(allPicks.filter(p => p.user_id === myId));

      // Lasketaan pistetaulukko
      const scores: any = {};
      allPicks.forEach((p: any) => {
        const uid = p.user_id;
        const pts = p.players?.points || 0;
        scores[uid] = (scores[uid] || 0) + pts;
      });

      const board = Object.entries(scores).map(([uid, pts]) => ({ uid, pts: pts as number }));
      setLeaderboard(board.sort((a: any, b: any) => b.pts - a.pts));
    }
    setLoading(false);
  }

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert("Tunnus luotu! Voit nyt kirjautua.");
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleLogout = () => supabase.auth.signOut();

  async function selectPlayer(player: any) {
    const currentCost = team.reduce((acc, curr) => acc + (curr.players?.price || 0), 0);
    if (currentCost + player.price > BUDGET) return alert("Budjetti ylittyy!");
    const { error } = await supabase.from('picks').insert([{ player_id: player.id, user_id: user.id }]);
    if (!error) loadData();
  }

  async function removePlayer(pickId: string) {
    const { error } = await supabase.from('picks').delete().eq('id', pickId);
    if (!error) loadData();
  }

  const totalCost = team.reduce((acc, curr) => acc + (curr.players?.price || 0), 0);
  const totalPoints = team.reduce((acc, curr) => acc + (curr.players?.points || 0), 0);
  const moneyLeft = BUDGET - totalCost;

  if (loading && !user) return <p style={{ padding: '20px' }}>Ladataan...</p>;

  // KIRJAUTUMISRUUTU
  if (!user) {
    return (
      <main style={{ padding: '40px', maxWidth: '400px', margin: '0 auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1>BogiPörssi 2026</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          <input type="email" placeholder="Sähköposti" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <input type="password" placeholder="Salasana" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <button onClick={handleLogin} style={{ padding: '12px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Kirjaudu sisään</button>
          <button onClick={handleSignUp} style={{ padding: '10px', backgroundColor: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>Luo uusi tunnus</button>
        </div>
      </main>
    );
  }

  // PELINÄKYMÄ
  return (
    <main style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '0.8rem', color: '#666' }}>{user.email}</span>
        <button onClick={handleLogout} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer', fontSize: '0.8rem' }}>Kirjaudu ulos</button>
      </div>
      
      <h1 style={{ textAlign: 'center' }}>BogiPörssi 2026</h1>
      
      {/* OMA JOUKKUE */}
      <section style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <h2 style={{ marginTop: 0 }}>Joukkueesi: {totalPoints} pistettä</h2>
        <p style={{ color: moneyLeft >= 0 ? 'green' : 'red', fontWeight: 'bold' }}>
          Budjettia jäljellä: {moneyLeft.toLocaleString()} €
        </p>
        {team.map((pick) => (
          <div key={pick.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <div>
              <span style={{ fontWeight: 'bold' }}>{pick.players?.name}</span>
              <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9rem' }}>
                ({pick.players?.price.toLocaleString()} €)
              </span>
            </div>
            <button onClick={() => removePlayer(pick.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
          </div>
        ))}
      </section>

      {/* PISTETAULUKKO */}
      <section style={{ backgroundColor: '#333', color: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>Pistetaulukko (Leaderboard)</h2>
        {leaderboard.map((entry, index) => (
          <div key={entry.uid} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #444', fontWeight: entry.uid === user.id ? 'bold' : 'normal' }}>
            <span>{index + 1}. {entry.uid === user.id ? "SINÄ" : "Kaveri"}</span>
            <span>{entry.pts} p</span>
          </div>
        ))}
      </section>

      {/* MARKKINAT */}
      <section>
        <h2>Siirtomarkkinat</h2>
        {players.sort((a,b) => b.rating - a.rating).map((player) => (
          <div key={player.id} style={{ backgroundColor: '#fff', padding: '15px', marginBottom: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{player.name}</div>
              <div style={{ color: 'green' }}>{player.price.toLocaleString()} €</div>
            </div>
            <button 
              onClick={() => selectPlayer(player)} 
              disabled={totalCost + player.price > BUDGET} 
              style={{ padding: '10px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
              Osta
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}