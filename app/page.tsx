"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Player {
  id: string;
  name: string;
  rating: number;
  price: number;
  points: number; // Uusi kenttä pisteille
}

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const BUDGET = 1000000; 

  async function loadData() {
    const { data: allPlayers } = await supabase.from('players').select('*');
    if (allPlayers) setPlayers(allPlayers);

    const { data: allPicks } = await supabase
      .from('picks')
      .select(`id, player_id, players (name, price, points)`);
    
    if (allPicks) setTeam(allPicks);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function selectPlayer(player: Player) {
    const currentCost = team.reduce((acc, curr) => acc + (curr.players?.price || 0), 0);
    if (currentCost + player.price > BUDGET) {
      alert("Budjetti ylittyy!");
      return;
    }
    const { error } = await supabase.from('picks').insert([{ player_id: player.id }]);
    if (!error) loadData();
  }

  async function removePlayer(pickId: string) {
    const { error } = await supabase.from('picks').delete().eq('id', pickId);
    if (!error) loadData();
  }

  // LASKENTA: Pisteet ja hinta
  const totalCost = team.reduce((acc, curr) => acc + (curr.players?.price || 0), 0);
  const totalPoints = team.reduce((acc, curr) => acc + (curr.players?.points || 0), 0);
  const moneyLeft = BUDGET - totalCost;

  if (loading) return <p style={{ padding: '20px' }}>Ladataan...</p>;

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center' }}>BogiPörssi 2026</h1>
      
      <section style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>Sinun joukkueesi</h2>
          <div style={{ backgroundColor: '#0070f3', color: 'white', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
            Pisteet: {totalPoints}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1, padding: '10px', background: '#e7f3ff', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: '#555' }}>Käytetty:</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{totalCost.toLocaleString()} €</div>
          </div>
          <div style={{ flex: 1, padding: '10px', background: moneyLeft >= 0 ? '#e6ffed' : '#ffebe9', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: '#555' }}>Jäljellä:</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: moneyLeft >= 0 ? 'green' : 'red' }}>
              {moneyLeft.toLocaleString()} €
            </div>
          </div>
        </div>
        
        {team.map((pick) => (
          <div key={pick.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <span>{pick.players?.name} ({pick.players?.points} p)</span>
            <div>
              <span style={{ marginRight: '15px' }}>{pick.players?.price.toLocaleString()} €</span>
              <button onClick={() => removePlayer(pick.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>X</button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Siirtomarkkinat</h2>
        {players.sort((a,b) => b.rating - a.rating).map((player) => (
          <div key={player.id} style={{ 
            backgroundColor: '#fff', padding: '15px', marginBottom: '10px', borderRadius: '8px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            opacity: totalCost + player.price > BUDGET ? 0.6 : 1
          }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{player.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>Rating: {player.rating} | <b>Pisteet: {player.points}</b></div>
              <div style={{ color: 'green', fontWeight: 'bold' }}>{player.price.toLocaleString()} €</div>
            </div>
            <button 
              onClick={() => selectPlayer(player)}
              disabled={totalCost + player.price > BUDGET}
              style={{ backgroundColor: totalCost + player.price > BUDGET ? '#ccc' : '#0070f3', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}
            >
              Osta
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}