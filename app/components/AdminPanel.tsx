"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ARCHIVE_HOT_HIO_AUX_TEAM_NAME } from '../../lib/archiveDisplay';
import { supabase } from '../../lib/supabase';

interface AdminPanelProps {
  activeTournament: any;
  players: any[];
  /** Kaikki pelaajat (nimet) — arkiston Hot/HIO -lisärivit pelaajille joita kukaan ei valinnut. */
  allPlayersForArchive: any[];
  /** Hall of Fame -korjauksia varten: arkistoidut rivit (tournament_results). */
  history: any[];
  refreshData: () => void | Promise<void>;
  adminSearch: string;
  setAdminSearch: (val: string) => void;
  handleRatingImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importResultsFromCsvFile: (file: File) => void | Promise<void>;
  startNewTournament: () => void;
  toggleTournamentLock: () => void;
  /** Aktiivisen turnauksen pick-rivejä (Tulokset / vianetsintä). */
  picksRowCountForActiveTournament: number;
  updateTournamentName: (newName: string) => void;
  updateTournamentRoundParStrokes: (value: number | null) => void | Promise<void>;
  saveAdminStats: (pId: string, par: number, rounds: number, hot: number, hio: number, pos: number, newRat: number) => void;
}

function archiveHotHioGroupKey(row: any): string {
  const name = row.tournament_name || 'Tuntematon';
  const seg =
    row.season_segment != null && Number.isFinite(Number(row.season_segment))
      ? Number(row.season_segment)
      : 'legacy';
  return JSON.stringify([name, seg]);
}

function archiveHotHioGroupLabel(key: string): string {
  try {
    const [name, seg] = JSON.parse(key) as [string, number | string];
    return seg === 'legacy' ? String(name) : `${name} (osa ${seg})`;
  } catch {
    return key;
  }
}

function parseArchiveHotHioKey(key: string): { tournament_name: string; season_segment: number | 'legacy' } | null {
  try {
    const [tournament_name, seg] = JSON.parse(key) as [string, number | string];
    if (seg === 'legacy') return { tournament_name: String(tournament_name), season_segment: 'legacy' };
    const n = Number(seg);
    return { tournament_name: String(tournament_name), season_segment: Number.isFinite(n) ? n : 'legacy' };
  } catch {
    return null;
  }
}

function normPlayerName(n: string) {
  return String(n || '')
    .trim()
    .toLowerCase();
}

export default function AdminPanel({
  activeTournament,
  players,
  allPlayersForArchive,
  history,
  refreshData,
  adminSearch,
  setAdminSearch,
  handleRatingImport,
  importResultsFromCsvFile,
  startNewTournament,
  toggleTournamentLock,
  picksRowCountForActiveTournament,
  saveAdminStats,
  updateTournamentName,
  updateTournamentRoundParStrokes,
}: AdminPanelProps) {
  const resultsCsvRef = useRef<HTMLInputElement>(null);
  const tournamentId = activeTournament?.id;

  const [roundParDraft, setRoundParDraft] = useState('');
  const [roundParDirty, setRoundParDirty] = useState(false);
  const [roundParSaving, setRoundParSaving] = useState(false);
  const [roundParMessage, setRoundParMessage] = useState<string | null>(null);

  useEffect(() => {
    setRoundParDirty(false);
  }, [tournamentId]);

  useEffect(() => {
    if (roundParDirty) return;
    const v = activeTournament?.round_par_strokes;
    setRoundParDraft(v != null && Number(v) > 0 ? String(Math.round(Number(v))) : '');
  }, [tournamentId, activeTournament?.round_par_strokes, roundParDirty]);

  useEffect(() => {
    if (!roundParMessage) return;
    const t = window.setTimeout(() => setRoundParMessage(null), 3500);
    return () => window.clearTimeout(t);
  }, [roundParMessage]);

  const archiveHotHioGroups = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const row of history || []) {
      if (!row?.id) continue;
      const k = archiveHotHioGroupKey(row);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(row);
    }
    return [...m.entries()].sort((a, b) => {
      const maxA = Math.max(0, ...a[1].map((r: any) => new Date(r.created_at || 0).getTime()));
      const maxB = Math.max(0, ...b[1].map((r: any) => new Date(r.created_at || 0).getTime()));
      return maxB - maxA;
    });
  }, [history]);

  const [archiveHotHioKey, setArchiveHotHioKey] = useState<string>('');
  const [archiveHotHioDrafts, setArchiveHotHioDrafts] = useState<Record<string, { hot: string; hio: string }>>({});
  const [archiveHotHioSaving, setArchiveHotHioSaving] = useState(false);
  const [archiveHotHioMsg, setArchiveHotHioMsg] = useState<string | null>(null);
  const [archiveHotHioPending, setArchiveHotHioPending] = useState<
    Array<{ id: string; player_name: string; hot: string; hio: string }>
  >([]);
  const [archiveHotHioAddName, setArchiveHotHioAddName] = useState('');

  useEffect(() => {
    setArchiveHotHioPending([]);
    setArchiveHotHioAddName('');
  }, [archiveHotHioKey]);

  useEffect(() => {
    if (!archiveHotHioKey) {
      setArchiveHotHioDrafts({});
      return;
    }
    const rows = archiveHotHioGroups.find(([k]) => k === archiveHotHioKey)?.[1] || [];
    const next: Record<string, { hot: string; hio: string }> = {};
    for (const r of rows) {
      next[r.id] = {
        hot: r.hot_rounds != null && r.hot_rounds !== '' ? String(r.hot_rounds) : '',
        hio: r.hio_count != null && r.hio_count !== '' ? String(r.hio_count) : '',
      };
    }
    setArchiveHotHioDrafts(next);
  }, [archiveHotHioKey, archiveHotHioGroups]);

  const archiveHotHioParsedKey = archiveHotHioKey ? parseArchiveHotHioKey(archiveHotHioKey) : null;
  const archiveHotHioExistingNames = useMemo(() => {
    if (!archiveHotHioKey) return new Set<string>();
    const rows = archiveHotHioGroups.find(([k]) => k === archiveHotHioKey)?.[1] || [];
    const s = new Set<string>();
    for (const r of rows) {
      const n = normPlayerName(r.player_name || '');
      if (n) s.add(n);
    }
    for (const p of archiveHotHioPending) {
      const n = normPlayerName(p.player_name);
      if (n) s.add(n);
    }
    return s;
  }, [archiveHotHioKey, archiveHotHioGroups, archiveHotHioPending]);

  const archiveHotHioAddableNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const pl of allPlayersForArchive || []) {
      const name = String(pl?.name || '').trim();
      if (!name) continue;
      const key = normPlayerName(name);
      if (archiveHotHioExistingNames.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    out.sort((a, b) => a.localeCompare(b, 'fi'));
    return out;
  }, [allPlayersForArchive, archiveHotHioExistingNames]);

  async function saveArchiveHotHioDrafts() {
    if (!archiveHotHioKey || !archiveHotHioParsedKey) return;
    const rows = archiveHotHioGroups.find(([k]) => k === archiveHotHioKey)?.[1] || [];
    const { tournament_name, season_segment } = archiveHotHioParsedKey;
    setArchiveHotHioSaving(true);
    setArchiveHotHioMsg(null);
    try {
      for (const r of rows) {
        const d = archiveHotHioDrafts[r.id];
        if (!d) continue;
        const hotP = parseInt(d.hot.trim(), 10);
        const hioP = parseInt(d.hio.trim(), 10);
        const hotV = d.hot.trim() === '' || !Number.isFinite(hotP) ? 0 : Math.max(0, hotP);
        const hioV = d.hio.trim() === '' || !Number.isFinite(hioP) ? 0 : Math.max(0, hioP);
        const { error } = await supabase
          .from('tournament_results')
          .update({ hot_rounds: hotV, hio_count: hioV })
          .eq('id', r.id);
        if (error) {
          alert('Arkiston tallennus epäonnistui: ' + (error.message || 'tuntematon'));
          return;
        }
      }

      for (const pend of archiveHotHioPending) {
        const hotP = parseInt(pend.hot.trim(), 10);
        const hioP = parseInt(pend.hio.trim(), 10);
        const hotV = pend.hot.trim() === '' || !Number.isFinite(hotP) ? 0 : Math.max(0, hotP);
        const hioV = pend.hio.trim() === '' || !Number.isFinite(hioP) ? 0 : Math.max(0, hioP);
        if (hotV === 0 && hioV === 0) continue;

        let insert: Record<string, unknown> = {
          tournament_name,
          player_name: pend.player_name.trim(),
          manager_name: '—',
          team_name: ARCHIVE_HOT_HIO_AUX_TEAM_NAME,
          player_score: 0,
          player_rounds: 0,
          earned_points: 0,
          buy_price: null,
          hot_rounds: hotV,
          hio_count: hioV,
        };
        if (season_segment !== 'legacy') {
          insert.season_segment = season_segment;
        }

        const missingCol = (err: { message?: string } | null, col: string) => {
          const m = (err?.message || '').toLowerCase();
          return m.includes(col) && (m.includes('column') || m.includes('schema') || m.includes('not exist'));
        };

        let insErr = (await supabase.from('tournament_results').insert(insert)).error;
        if (insErr && missingCol(insErr, 'season_segment')) {
          const { season_segment: _s, ...rest } = insert;
          insert = rest;
          insErr = (await supabase.from('tournament_results').insert(insert)).error;
        }
        if (insErr && missingCol(insErr, 'buy_price')) {
          const { buy_price: _b, ...rest } = insert;
          insert = rest;
          insErr = (await supabase.from('tournament_results').insert(insert)).error;
        }
        if (insErr && (missingCol(insErr, 'hot_rounds') || missingCol(insErr, 'hio_count'))) {
          alert(
            'Uuden rivin lisäys epäonnistui (hot/hio -sarakkeet?): ' +
              (insErr.message || 'tuntematon') +
              '\n\nVarmista että tournament_results sisältää hot_rounds ja hio_count.'
          );
          return;
        }
        if (insErr) {
          alert('Uuden rivin lisäys epäonnistui: ' + (insErr.message || 'tuntematon'));
          return;
        }
      }

      setArchiveHotHioPending([]);
      setArchiveHotHioMsg('Tallennettu. Hall of Fame käyttää näitä lukuja koko kauden summassa.');
      await refreshData();
    } finally {
      setArchiveHotHioSaving(false);
    }
  }

  async function saveRoundParStrokes() {
    setRoundParMessage(null);
    const raw = roundParDraft.trim();
    if (raw === '') {
      setRoundParSaving(true);
      try {
        await updateTournamentRoundParStrokes(null);
        setRoundParDirty(false);
        setRoundParMessage('Tallennettu: ei kierroksen par-lukua (rd-*-CSV vaatii luvun).');
      } finally {
        setRoundParSaving(false);
      }
      return;
    }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 200) {
      setRoundParMessage('Anna kokonaisluku 1–200 tai jätä tyhjäksi.');
      return;
    }
    setRoundParSaving(true);
    try {
      await updateTournamentRoundParStrokes(n);
      setRoundParDirty(false);
      setRoundParMessage('Tallennettu.');
    } finally {
      setRoundParSaving(false);
    }
  }

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

      <div
        style={{
          marginBottom: '18px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: '12px',
          lineHeight: 1.55,
          color: 'rgba(255,255,255,0.62)',
        }}
      >
        <p style={{ margin: '0 0 8px' }}>
          <strong style={{ color: 'rgba(255,255,255,0.88)' }}>Lukitus</strong> estää uudet valinnat ja näyttää tulostaululla kaikkien rosterit.
          Se <strong style={{ color: 'rgba(255,255,255,0.88)' }}>ei tyhjennä</strong> <span style={{ fontFamily: 'ui-monospace, monospace' }}>picks</span>-taulua eikä aloita uutta kierrosta.
        </p>
        <p style={{ margin: '0 0 8px' }}>
          <strong style={{ color: 'rgba(255,255,255,0.88)' }}>Uusi kisa</strong> arkistoi tämän kisan valinnat ja pisteet historiaan, nollaa kenttäpelaajien tilastot, poistaa tämän turnauksen pick-rivit ja avaa seuraavan osion (
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>season_segment</span> +1). Tyhjä rosteri = tämä polku.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.45)',
            fontFamily: 'ui-monospace, monospace',
            wordBreak: 'break-all',
          }}
        >
          Vianetsintä: turnaus-id {tournamentId ? String(tournamentId) : '—'} · pick-rivejä tässä kisassa: {picksRowCountForActiveTournament}
        </p>
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

      <div style={styles.tournamentNameBox}>
        <div style={styles.labelRow}>
          <div style={styles.dot('#34d399')} />
          <label style={styles.label}>Kierroksen par (heitot)</label>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: '12px', lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
          Sama luku kaikille kierroksille tässä kisassa (esim. 54). CSV:n <span style={{ fontFamily: 'ui-monospace, monospace', color: 'rgba(167,243,208,0.95)' }}>rd_1</span>,{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace', color: 'rgba(167,243,208,0.95)' }}>rd_2</span>… -sarakkeiden heitot vähennetään tästä → par-ero fantasy-laskentaan.{' '}
          <strong style={{ color: 'rgba(255,255,255,0.82)' }}>Tallenna</strong> kun olet valmis — arvo ei muutu tietokantaan ennen sitä.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <input
            type="number"
            min={1}
            max={200}
            value={roundParDraft}
            onChange={(e) => {
              setRoundParDraft(e.target.value);
              setRoundParDirty(true);
            }}
            placeholder="esim. 54"
            className="bp-input"
            style={{ maxWidth: '140px' }}
            aria-label="Kierroksen par heittoina"
          />
          <button
            type="button"
            onClick={() => void saveRoundParStrokes()}
            disabled={roundParSaving}
            className="bp-btn-primary"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            {roundParSaving ? 'Tallennetaan…' : 'Tallenna kierroksen par'}
          </button>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
            Tyhjä + tallenna = ei asetettu (rd-*-tuonti vaatii luvun).
          </span>
        </div>
        {roundParMessage ? (
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'rgba(167,243,208,0.95)' }} role="status">
            {roundParMessage}
          </p>
        ) : null}
      </div>

      {archiveHotHioGroups.length > 0 ? (
        <div style={styles.tournamentNameBox}>
          <div style={styles.labelRow}>
            <div style={styles.dot('#fbbf24')} />
            <label style={styles.label}>Arkiston Hot / HIO (vanhat kisat)</label>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '12px', lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
            Kisat, jotka arkistoitiin ennen hot_rounds- ja hio_count -sarakkeita, tallentuivat ilman näitä lukuja.
            Täytä ne tähän jos haluat ensimmäisen (tai muun vanhan) kisan mukaan Hall of Famen{' '}
            <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Hot round -sankariin</strong> ja{' '}
            <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Holari-kuningas</strong> -laskentaan. Uudet arkistoinnit täyttävät kentät automaattisesti.
            Jos pelaajalla oli hot/hio-määriä mutta häntä ei ollut kenenkään joukkueessa, lisää rivi pudotusvalikosta (tallennetaan uutena arkistorivinä).
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <select
              className="bp-input"
              style={{ minWidth: '220px', maxWidth: '100%' }}
              value={archiveHotHioKey}
              onChange={(e) => setArchiveHotHioKey(e.target.value)}
              aria-label="Valitse arkistoitu kisa"
            >
              <option value="">Valitse arkistoitu kisa…</option>
              {archiveHotHioGroups.map(([k]) => (
                <option key={k} value={k}>
                  {archiveHotHioGroupLabel(k)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="bp-btn-primary"
              style={{ padding: '8px 14px', fontSize: '13px' }}
              disabled={!archiveHotHioKey || archiveHotHioSaving}
              onClick={() => void saveArchiveHotHioDrafts()}
            >
              {archiveHotHioSaving ? 'Tallennetaan…' : 'Tallenna tämän kisan Hot/HIO'}
            </button>
          </div>
          {archiveHotHioMsg ? (
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(167,243,208,0.95)' }} role="status">
              {archiveHotHioMsg}
            </p>
          ) : null}
          {archiveHotHioKey ? (
            <>
              <div
                style={{
                  marginBottom: '10px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <select
                  className="bp-input"
                  value={archiveHotHioAddName}
                  onChange={(e) => setArchiveHotHioAddName(e.target.value)}
                  style={{ minWidth: '220px', maxWidth: '100%' }}
                  aria-label="Pelaaja jota ei valittu ketään joukkueeseen"
                >
                  <option value="">Lisää pelaaja (ei ketään valinnut)…</option>
                  {archiveHotHioAddableNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="bp-btn-primary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  disabled={!archiveHotHioAddName.trim()}
                  onClick={() => {
                    const name = archiveHotHioAddName.trim();
                    if (!name) return;
        setArchiveHotHioPending((prev) => [
          ...prev,
          {
            id: `pend-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`,
            player_name: name,
            hot: '',
            hio: '',
          },
        ]);
                    setArchiveHotHioAddName('');
                  }}
                >
                  Lisää listaan
                </button>
              </div>
              <div
                style={{
                  maxHeight: '320px',
                  overflow: 'auto',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.25)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Tiimi</th>
                      <th style={{ padding: '8px' }}>Pelaaja</th>
                      <th style={{ padding: '8px' }}>Hot</th>
                      <th style={{ padding: '8px' }}>HIO</th>
                      <th style={{ padding: '8px', width: '72px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {(archiveHotHioGroups.find(([k]) => k === archiveHotHioKey)?.[1] || []).map((r: any) => (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.75)' }}>{r.team_name || '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{r.player_name || '—'}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="number"
                            min={0}
                            className="bp-input"
                            style={{ width: '72px', padding: '4px 8px' }}
                            value={archiveHotHioDrafts[r.id]?.hot ?? ''}
                            onChange={(e) =>
                              setArchiveHotHioDrafts((prev) => ({
                                ...prev,
                                [r.id]: { ...(prev[r.id] || { hot: '', hio: '' }), hot: e.target.value },
                              }))
                            }
                            aria-label={`Hot ${r.player_name}`}
                          />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="number"
                            min={0}
                            className="bp-input"
                            style={{ width: '72px', padding: '4px 8px' }}
                            value={archiveHotHioDrafts[r.id]?.hio ?? ''}
                            onChange={(e) =>
                              setArchiveHotHioDrafts((prev) => ({
                                ...prev,
                                [r.id]: { ...(prev[r.id] || { hot: '', hio: '' }), hio: e.target.value },
                              }))
                            }
                            aria-label={`HIO ${r.player_name}`}
                          />
                        </td>
                        <td style={{ padding: '4px 8px' }} />
                      </tr>
                    ))}
                    {archiveHotHioPending.map((pend) => (
                      <tr key={pend.id} style={{ borderTop: '1px solid rgba(251,191,36,0.35)' }}>
                        <td style={{ padding: '6px 8px', color: 'rgba(251,191,36,0.9)' }}>
                          {ARCHIVE_HOT_HIO_AUX_TEAM_NAME}
                        </td>
                        <td style={{ padding: '6px 8px' }}>{pend.player_name}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="number"
                            min={0}
                            className="bp-input"
                            style={{ width: '72px', padding: '4px 8px' }}
                            value={pend.hot}
                            onChange={(e) =>
                              setArchiveHotHioPending((prev) =>
                                prev.map((x) => (x.id === pend.id ? { ...x, hot: e.target.value } : x))
                              )
                            }
                            aria-label={`Hot ${pend.player_name}`}
                          />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="number"
                            min={0}
                            className="bp-input"
                            style={{ width: '72px', padding: '4px 8px' }}
                            value={pend.hio}
                            onChange={(e) =>
                              setArchiveHotHioPending((prev) =>
                                prev.map((x) => (x.id === pend.id ? { ...x, hio: e.target.value } : x))
                              )
                            }
                            aria-label={`HIO ${pend.player_name}`}
                          />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <button
                            type="button"
                            className="bp-input"
                            style={{ padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                            onClick={() =>
                              setArchiveHotHioPending((prev) => prev.filter((x) => x.id !== pend.id))
                            }
                          >
                            Poista
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Tulosten tuonti CSV (Excel → Tallenna nimellä CSV UTF-8) */}
      <div style={styles.tournamentNameBox}>
        <div style={styles.labelRow}>
          <div style={styles.dot('#34d399')} />
          <label style={styles.label}>Tulosten tuonti (CSV)</label>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '12px', lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
          Excelissä paras: <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Tallenna nimellä → CSV UTF-8</strong>.
          Tuonti yrittää myös lukea Windows Excelin tavallisen ANSI/CSV-koodauksen (Väinö, Semerád jne.).
          Erotin: puolipiste tai pilkku; tab-taulukko käy.
          Perusotsikot (esim.):{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace', color: 'rgba(167,243,208,0.95)' }}>
            name;par;rating;place
          </span>{' '}
          + <span style={{ fontFamily: 'ui-monospace, monospace', color: 'rgba(167,243,208,0.95)' }}>Pelaaja;Tulos;Kierrokset;Hot;HIO;Sija</span>
          -tyyli käy edelleen. <strong style={{ color: 'rgba(255,255,255,0.85)' }}>place</strong> (sijoitusluku) → bonus: 1.→10, 2–3.→5, 4–10.→2 pistettä. Jos{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>Sija</span>-sarake on täytetty tekstinä (1., T10), sitä käytetään ensisijaisesti.
          <br />
          <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Heitot per kierros:</strong> sarakkeet{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace', color: 'rgba(167,243,208,0.95)' }}>rd_1;rd_2;rd_3</span>
          (voit lisätä <span style={{ fontFamily: 'ui-monospace, monospace' }}>rd_4</span>, <span style={{ fontFamily: 'ui-monospace, monospace' }}>rd_5</span>…) + valinnainen{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>hot_round_1;hio_1;…</span>. Aseta yläpuolelle{' '}
          <strong>Kierroksen par (heitot)</strong> ja <strong>Tallenna kierroksen par</strong> ennen tuontia — par-ero = heitot − tuo luku.
          <br />
          Vaihtoehto: suora par-ero kierroksittain:{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace', color: 'rgba(167,243,208,0.95)' }}>k1_par;k1_hot;k1_hio;…</span>
          <br />
          Tuonti <strong style={{ color: 'rgba(255,255,255,0.85)' }}>ylikirjoittaa</strong> samat kentät kuin rivin Tallenna-nappi.
          <strong style={{ color: 'rgba(251,191,36,0.9)' }}> Tallenna</strong> tyhjentää kierroskohtaisen tallennuksen (käytä CSV:ää uudelleen erittelyä varten).
        </p>
        <input
          ref={resultsCsvRef}
          type="file"
          accept=".csv,.txt,text/csv"
          id="results-csv-upload"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            await importResultsFromCsvFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => resultsCsvRef.current?.click()}
          className="bp-btn-primary"
          style={{ marginRight: '10px' }}
        >
          Valitse tulos-CSV…
        </button>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
          Manuaalinen syöttö taulukossa säilyy (ei kierrosrivejä — kierrokset vain CSV:stä).
        </span>
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