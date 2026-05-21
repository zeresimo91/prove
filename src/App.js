import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Draggable from 'react-draggable';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- FUNZIONI DI FORMATTAZIONE ---
const formatData = (isoString) => { if (!isoString) return ''; const d = new Date(isoString); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatDataLeggibile = (isoString) => { if (!isoString) return ''; return new Date(isoString).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
const formatOra = (isoString) => { if (!isoString) return ''; return new Date(isoString).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };
const formatDataOraLeggibile = (isoString) => { if (!isoString) return ''; return new Date(isoString).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const getServizioDaOra = (isoString) => { if (!isoString) return 'cena'; return new Date(isoString).getHours() < 16 ? 'pranzo' : 'cena'; };

export default function App() {
  // --- STATI ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); 
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sale, setSale] = useState([]);
  const [tuttiITavoli, setTuttiITavoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [dataVista, setDataVista] = useState(formatData(new Date().toISOString()));
  const [servizioVista, setServizioVista] = useState(new Date().getHours() < 16 ? 'pranzo' : 'cena');
  const [nomeCliente, setNomeCliente] = useState('');
  const [numeroPersone, setNumeroPersone] = useState('');
  const [oraEsatta, setOraEsatta] = useState('');
  const [note, setNote] = useState('');
  const [tavoliSelezionati, setTavoliSelezionati] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tavoloInfo, setTavoloInfo] = useState(null); 
  const [ricerca, setRicerca] = useState(''); 
  const [prenoInSpostamento, setPrenoInSpostamento] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [showDisponibilita, setShowDisponibilita] = useState(false);
  const [showStatistiche, setShowStatistiche] = useState(false);
  const [showCestino, setShowCestino] = useState(false);
  const [showUltime10, setShowUltime10] = useState(false);
  const [ultime10, setUltime10] = useState([]); 
  const [nuoveNotifiche, setNuoveNotifiche] = useState([]);

  const fileInputRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [mapScale, setMapScale] = useState(1);
  const VIRTUAL_WIDTH = 1500; 
  const VIRTUAL_HEIGHT = 1000; 
  const isAdmin = userRole === 'admin';

  // --- LOGICHE DI CARICAMENTO ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => gestisciSessioneUtente(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => gestisciSessioneUtente(session));
    return () => subscription.unsubscribe();
  }, []);

  const gestisciSessioneUtente = (session) => {
    if (session) {
      setIsLoggedIn(true);
      setUserRole(session.user.email === 'admin@belvedere.com' ? 'admin' : 'cameriere');
    } else {
      setIsLoggedIn(false);
      setUserRole(null);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      const channel = supabase.channel('realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni' }, (payload) => { 
            if (payload.eventType === 'INSERT') setNuoveNotifiche(prev => [...prev, payload.new]);
            caricaPrenotazioni(); 
        }).on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => { 
            caricaTuttiITavoli(); 
        }).subscribe();
      aggiornaTutto();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn]);

  const aggiornaTutto = () => { caricaSale(); caricaPrenotazioni(); caricaTuttiITavoli(); };
  async function caricaSale() { let { data } = await supabase.from('sale').select('*').order('ordine'); if (data) setSale(data); }
  async function caricaPrenotazioni() { let { data } = await supabase.from('prenotazioni').select('*').eq('eliminata', false).order('data_ora', { ascending: false }); if (data) setPrenotazioni(data); }
  async function caricaTuttiITavoli() { let { data } = await supabase.from('tavoli').select('*'); if (data) setTuttiITavoli(data); }

  // --- ULTIME 10 CON SQL ---
  const apriUltime10 = async () => {
    const { data, error } = await supabase.from('prenotazioni').select('*').eq('eliminata', false).order('created_at', { ascending: false }).limit(10);
    if (error) alert("Errore database: " + error.message);
    else { setUltime10(data || []); setShowUltime10(true); }
  };

  // --- LOGICA AGGIUNTA TAVOLI CON SCELTA SALA ---
  async function aggiungiElemento(tipo) {
    if (!sale || sale.length === 0) return alert("Crea una sala prima!");
    let msg = `Scegli la SALA per il nuovo ${tipo}:\n` + sale.map((s, i) => `${i + 1} - ${s.nome}`).join('\n');
    const scelta = window.prompt(msg, "1");
    if (scelta === null) return;
    const indice = parseInt(scelta) - 1;
    if (isNaN(indice) || indice < 0 || indice >= sale.length) return alert("Sala non valida.");
    
    await supabase.from('tavoli').insert([{ 
      sala_id: sale[indice].id, 
      numero_tavolo: tipo === 'tavolo' ? '?' : 'MURO_300x20', 
      capacita: tipo === 'tavolo' ? 2 : 0, 
      pos_x: 200, pos_y: 200, std_x: 200, std_y: 200 
    }]);
    caricaTuttiITavoli();
  }

  // --- LOGICA COLORE TAVOLO (ROSSO SE >= 2 PRENOTAZIONI) ---
  const getPrenotazioniTurno = (id) => prenotazioni.filter(p => p.tavoli_assegnati && p.tavoli_assegnati.includes(id) && formatData(p.data_ora) === dataVista && getServizioDaOra(p.data_ora) === servizioVista);
  const getStileTavolo = (id) => {
    const pres = getPrenotazioniTurno(id);
    if (tavoliSelezionati.includes(id)) return { bg: '#cfe2ff', b: '#0d6efd' };
    if (pres.length >= 2) return { bg: '#dc3545', b: '#a71d2a' }; // ROSSO FORZATO
    if (pres.some(p => p.presente)) return { bg: '#d1e7dd', b: '#28a745' };
    if (pres.length === 1) return { bg: '#fd7e14', b: '#d35400' };
    return { bg: 'white', b: '#adb5bd' };
  };

  // --- UI ---
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
       {!isLoggedIn ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <form onSubmit={handleLogin} style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '300px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <h3>Accesso Riservato</h3>
              <input type="email" placeholder="Email" onChange={e => setEmailInput(e.target.value)} required style={{width: '100%', marginBottom: '10px'}} />
              <input type="password" placeholder="Password" onChange={e => setPassInput(e.target.value)} required style={{width: '100%', marginBottom: '20px'}} />
              <button type="submit" style={{width: '100%', background: '#28a745', color: 'white', border: 'none', padding: '10px'}}>ACCEDI</button>
            </form>
          </div>
       ) : (
          <div>
            <header style={{ marginBottom: '20px', display: 'flex', gap: '10px', background: 'white', padding: '15px', borderRadius: '15px' }}>
                <button onClick={apriUltime10}>🕒 Ultime 10</button>
                {isAdmin && <button onClick={() => aggiungiElemento('tavolo')}>➕ Aggiungi Tavolo</button>}
                {isAdmin && <button onClick={() => aggiungiElemento('muro')}>🧱 Aggiungi Muro</button>}
                <button onClick={() => supabase.auth.signOut()}>Logout</button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
                {tuttiITavoli.map(t => {
                    const { bg, b } = getStileTavolo(t.id);
                    return (
                        <div key={t.id} style={{ background: bg, border: `3px solid ${b}`, padding: '15px', borderRadius: '15px', textAlign: 'center', fontWeight: 'bold' }}>
                            Tav. {t.numero_tavolo}
                            <div style={{fontSize: '12px', marginTop: '5px'}}>{getPrenotazioniTurno(t.id).length} Prenotazioni</div>
                        </div>
                    );
                })}
            </div>

            {/* MODALE ULTIME 10 */}
            {showUltime10 && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowUltime10(false)}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '400px' }} onClick={e => e.stopPropagation()}>
                        <h3>Ultime 10 Prenotazioni</h3>
                        {ultime10.map(p => <div key={p.id} style={{borderBottom: '1px solid #eee', padding: '5px 0'}}>{p.nome_cliente} - {formatOra(p.data_ora)}</div>)}
                        <button onClick={() => setShowUltime10(false)} style={{marginTop: '20px', width: '100%'}}>Chiudi</button>
                    </div>
                </div>
            )}
          </div>
       )}
    </div>
  );
}
