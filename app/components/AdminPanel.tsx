"use client";
import React from 'react';

interface AdminPanelProps {
  activeTournament: any;
  players: any[];
  adminSearch: string;
  setAdminSearch: (val: string) => void;
  handleRatingImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  startNewTournament: () => void;
  toggleTournamentLock: () => void;
  updateTournamentName: (newName: string) => void;
  saveAdminStats: (pId: string, par: number, rounds: number, hot: number, hio: number, pos: number, newRat: number) => void;
}

export default function AdminPanel({
  activeTournament, players, adminSearch, setAdminSearch, 
  handleRatingImport, startNewTournament, toggleTournamentLock, 
  saveAdminStats, updateTournamentName
}: AdminPanelProps) {
  
  const styles = {
    container: {
      position: 'relative' as const,
      overflow: 'hidden',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.04)',
      padding: '24px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      marginBottom: '32px',
    },
    glowOrb1: {
      position: 'absolute' as const,
      right: '-80px',
      top: '-80px',
      height: '160px',
      width: '160px',
      borderRadius: '50%',
      background: 'rgba(16, 185, 129, 0.1)',
      filter: 'blur(60px)',
      pointerEvents: 'none' as const,
    },
    glowOrb2: {
      position: 'absolute' as const,
      bottom: '-40px',
      left: '-40px',
      height: '120px',
      width: '120px',
      borderRadius: '50%',
      background: 'rgba(245, 158, 11, 0.1)',
      filter: 'blur(60px)',
      pointerEvents: 'none' as const,
    },
    header: {
      position: 'relative' as const,
      display: 'flex',
      flexWrap: 'wrap' as const,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      marginBottom: '24px',
    },
    titleGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    iconBox: {
      display: 'flex',
      height: '40px',
      width: '40px',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)',
    },
    title: {
      fontSize: '18px',
      fontWeight: 700,
      color: 'rgba(255,255,255,0.92)',
      margin: 0,
      letterSpacing: '-0.02em',
    },
    subtitle: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.60)',
      margin: 0,
    },
    buttonGroup: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      alignItems: 'center',
      gap: '8px',
    },
    btnSecondary: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderRadius: '8px',
      border: '1px solid #e4e4e7',
      background: '#ffffff',
      padding: '10px 16px',
      fontSize: '14px',
      fontWeight: 700,
      color: '#18181b',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    btnPrimary: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderRadius: '8px',
      border: 'none',
      background: '#18181b',
      padding: '10px 16px',
      fontSize: '14px',
      fontWeight: 700,
      color: '#ffffff',
      cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      transition: 'all 0.2s ease',
    },
    btnLock: (isLocked: boolean) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderRadius: '8px',
      border: '1px solid #e4e4e7',
      background: '#ffffff',
      padding: '10px 16px',
      fontSize: '14px',
      fontWeight: 700,
      color: isLocked ? '#16a34a' : '#dc2626',
      cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      transition: 'all 0.2s ease',
    }),
    tournamentNameBox: {
      position: 'relative' as const,
      marginBottom: '24px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.04)',
      padding: '20px',
    },
    labelRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '12px',
    },
    dot: (color: string) => ({
      height: '8px',
      width: '8px',
      borderRadius: '50%',
      background: color,
    }),
    label: {
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      color: 'rgba(255,255,255,0.60)',
    },
    input: {
      width: '100%',
      borderRadius: '8px',
      border: '1px solid #e4e4e7',
      background: '#ffffff',
      padding: '12px 16px',
      fontSize: '16px',
      fontWeight: 500,
      color: '#18181b',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    searchBox: {
      position: 'relative' as const,
      marginBottom: '24px',
    },
    searchIcon: {
      position: 'absolute' as const,
      left: '16px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'rgba(255,255,255,0.45)',
    },
    searchInput: {
      width: '100%',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.03)',
      padding: '12px 16px 12px 48px',
      fontSize: '14px',
      color: 'rgba(255,255,255,0.92)',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    tableContainer: {
      overflow: 'hidden',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.02)',
    },
    tableScroll: {
      maxHeight: '400px',
      overflowY: 'auto' as const,
    },
    table: {
      width: '100%',
      fontSize: '14px',
      borderCollapse: 'collapse' as const,
    },
    thead: {
      position: 'sticky' as const,
      top: 0,
      zIndex: 10,
      borderBottom: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(18,18,18,0.65)',
    },
    th: {
      padding: '16px',
      textAlign: 'left' as const,
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      color: 'rgba(255,255,255,0.55)',
    },
    thCenter: {
      padding: '16px',
      textAlign: 'center' as const,
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      color: 'rgba(255,255,255,0.55)',
    },
    tr: {
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      transition: 'background 0.2s ease',
    },
    td: {
      padding: '16px',
      color: 'rgba(255,255,255,0.90)',
    },
    tdCenter: {
      padding: '16px',
      textAlign: 'center' as const,
    },
    tdRight: {
      padding: '16px',
      textAlign: 'right' as const,
    },
    playerCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    avatar: {
      display: 'flex',
      height: '36px',
      width: '36px',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      background: 'rgba(52,211,153,0.20)',
      fontWeight: 700,
      fontSize: '14px',
      color: '#ffffff',
      border: '2px solid rgba(52,211,153,0.35)',
    },
    playerName: {
      fontWeight: 500,
      color: 'rgba(255,255,255,0.92)',
    },
    ratingBadge: {
      marginLeft: '8px',
      borderRadius: '6px',
      background: 'rgba(52,211,153,0.14)',
      padding: '2px 8px',
      fontSize: '12px',
      fontWeight: 600,
      color: 'rgba(167, 243, 208, 0.95)',
    },
    scoreGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    pmBtn: {
      display: 'flex',
      height: '32px',
      width: '32px',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.03)',
      color: 'rgba(255,255,255,0.80)',
      cursor: 'pointer',
      fontSize: '16px',
      transition: 'all 0.2s ease',
    },
    scoreInput: {
      height: '32px',
      width: '48px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.03)',
      textAlign: 'center' as const,
      fontFamily: 'monospace',
      fontWeight: 700,
      color: 'rgba(255,255,255,0.92)',
      outline: 'none',
    },
    roundsInput: {
      height: '32px',
      width: '40px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.03)',
      textAlign: 'center' as const,
      fontFamily: 'monospace',
      color: 'rgba(255,255,255,0.92)',
      outline: 'none',
    },
    bonusGroup: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      alignItems: 'center',
      gap: '12px',
      fontSize: '12px',
    },
    bonusLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    bonusInput: {
      height: '28px',
      width: '32px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.03)',
      textAlign: 'center' as const,
      fontFamily: 'monospace',
      color: 'rgba(255,255,255,0.92)',
      outline: 'none',
    },
    bonusSelect: {
      height: '28px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.03)',
      padding: '0 8px',
      fontWeight: 500,
      color: 'rgba(255,255,255,0.92)',
      outline: 'none',
    },
    saveBtn: {
      borderRadius: '8px',
      border: 'none',
      background: 'rgba(52, 211, 153, 0.18)',
      padding: '8px 16px',
      fontSize: '14px',
      fontWeight: 700,
      color: 'rgba(255,255,255,0.95)',
      cursor: 'pointer',
      boxShadow: '0 8px 16px rgba(52, 211, 153, 0.10)',
      transition: 'all 0.2s ease',
    },
    footer: {
      marginTop: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '12px',
      color: 'rgba(255,255,255,0.55)',
    },
    statusDot: (isLocked: boolean) => ({
      height: '8px',
      width: '8px',
      borderRadius: '50%',
      background: isLocked ? '#10b981' : '#f59e0b',
    }),
    statusRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
  };

  return (
    <section className="bp-card mb-6 p-5">
      
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={{ ...styles.iconBox, background: '#18181b', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <h3 style={styles.title}>Admin-paneeli</h3>
            <p style={styles.subtitle}>Hallitse turnauksia ja pelaajia</p>
          </div>
        </div>
        
        <div style={styles.buttonGroup}>
          <input type="file" accept=".csv" onChange={handleRatingImport} id="csv-upload" style={{ display: 'none' }} />
          
          <button 
            onClick={() => document.getElementById('csv-upload')?.click()} 
            className="bp-tab"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Rating CSV
          </button>
          
          <button onClick={startNewTournament} className="bp-btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v16m8-8H4" />
            </svg>
            Uusi kisa
          </button>
          
          <button
            onClick={toggleTournamentLock}
            className={["bp-tab", activeTournament?.is_locked ? "border border-zinc-200" : "border border-zinc-200"].join(" ")}
            style={{ color: activeTournament?.is_locked ? '#16a34a' : '#dc2626' }}
          >
            {activeTournament?.is_locked ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            {activeTournament?.is_locked ? 'Avaa' : 'Lukitse'}
          </button>
        </div>
      </div>

      {/* Tournament Name Input */}
      <div style={styles.tournamentNameBox}>
        <div style={styles.labelRow}>
          <div style={styles.dot('#71717a')} />
          <label style={styles.label}>Turnauksen nimi</label>
        </div>
        <input 
          type="text" 
          value={activeTournament?.name === 'Uusi Turnaus' ? '' : activeTournament?.name || ''} 
          onChange={(e) => updateTournamentName(e.target.value)}
          placeholder="Kirjoita kisan nimi tähän (esim. Hämeenlinna Open 2026)..."
          className="bp-input"
        />
      </div>
      
      {/* Search Input */}
      <div style={styles.searchBox}>
        <svg style={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input 
          type="text" 
          placeholder="Etsi pelaajaa nimellä..." 
          value={adminSearch} 
          onChange={e => setAdminSearch(e.target.value)} 
          style={styles.searchInput}
        />
      </div>

      {/* Players Table */}
      <div style={styles.tableContainer}>
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead style={styles.thead}>
              <tr>
                <th style={styles.th}>Pelaaja</th>
                <th style={styles.th}>Tulos</th>
                <th style={styles.thCenter}>Krs</th>
                <th style={styles.th}>Bonukset</th>
                <th style={{ ...styles.th, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {players.filter(p => p.name.toLowerCase().includes(adminSearch.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                <tr key={`${p.id}-${p.par_score}-${p.rounds_played}`} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.playerCell}>
                      <div style={styles.avatar}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span style={styles.playerName}>{p.name}</span>
                        <span style={styles.ratingBadge}>{p.official_rating}</span>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.scoreGroup}>
                      <button 
                        onClick={() => {const i = document.getElementById(`par-${p.id}`) as HTMLInputElement; i.value = (parseInt(i.value)-1).toString()}}
                        style={styles.pmBtn}
                      >
                        −
                      </button>
                      <input 
                        id={`par-${p.id}`} 
                        defaultValue={p.par_score} 
                        style={styles.scoreInput}
                      />
                      <button 
                        onClick={() => {const i = document.getElementById(`par-${p.id}`) as HTMLInputElement; i.value = (parseInt(i.value)+1).toString()}}
                        style={styles.pmBtn}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td style={styles.tdCenter}>
                    <input 
                      id={`rnd-${p.id}`} 
                      defaultValue={p.rounds_played} 
                      style={styles.roundsInput}
                    />
                  </td>
                  <td style={styles.td}>
                    <div style={styles.bonusGroup}>
                      <label style={styles.bonusLabel}>
                        <span style={{ fontWeight: 500, color: '#f87171' }}>H</span>
                        <input 
                          id={`hot-${p.id}`} 
                          defaultValue={p.hot_rounds} 
                          style={styles.bonusInput}
                        />
                      </label>
                      <label style={styles.bonusLabel}>
                        <span style={{ fontWeight: 500, color: '#22d3d1' }}>HI</span>
                        <input 
                          id={`hio-${p.id}`} 
                          defaultValue={p.hio_count} 
                          style={styles.bonusInput}
                        />
                      </label>
                      <label style={styles.bonusLabel}>
                        <span style={{ fontWeight: 500, color: '#fbbf24' }}>S</span>
                        <select 
                          id={`pos-${p.id}`} 
                          defaultValue={p.position_bonus} 
                          style={styles.bonusSelect}
                        >
                          <option value="0">−</option>
                          <option value="10">1.</option>
                          <option value="5">2.</option>
                          <option value="2">T10</option>
                        </select>
                      </label>
                    </div>
                  </td>
                  <td style={styles.tdRight}>
                    <button 
                      onClick={() => saveAdminStats(
                        p.id, 
                        parseInt((document.getElementById(`par-${p.id}`) as HTMLInputElement).value), 
                        parseInt((document.getElementById(`rnd-${p.id}`) as HTMLInputElement).value), 
                        parseInt((document.getElementById(`hot-${p.id}`) as HTMLInputElement).value), 
                        parseInt((document.getElementById(`hio-${p.id}`) as HTMLInputElement).value), 
                        parseInt((document.getElementById(`pos-${p.id}`) as HTMLSelectElement).value), 
                        p.official_rating
                      )} 
                      style={styles.saveBtn}
                    >
                      Tallenna
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer Stats */}
      <div style={styles.footer}>
        <span>{players.filter(p => p.name.toLowerCase().includes(adminSearch.toLowerCase())).length} pelaajaa</span>
        <div style={styles.statusRow}>
          <div style={styles.statusDot(activeTournament?.is_locked)} />
          <span>{activeTournament?.is_locked ? 'Turnaus lukittu' : 'Turnaus käynnissä'}</span>
        </div>
      </div>
    </section>
  );
}