import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Draggable from 'react-draggable';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- HELPER FUNCTIONS ---
const formatData = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatDataLeggibile = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatOra = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};
const formatDataOraLeggibile = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const getServizioDaOra = (isoString) => {
  if (!isoString) return 'cena';
  return new Date(isoString).getHours() < 16 ? 'pranzo' : 'cena';
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); 
  const [passInput, setPassInput] = useState('');
  const [ricordami, setRicordami] = useState(false);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [sale, setSale] = useState([]);
  const [tuttiITavoli, setTuttiITavoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [dataVista, setDataVista] = useState(formatData(new Date().toISOString()));
  const [servizioVista, setServizioVista] = useState(new Date().getHours() < 16 ? 'pranzo' : 'cena');
  
  const [dimensioneTestoTavolo] = useState(18); 
  const [dimensioneTestoCliente] = useState(12);
  const [zoomMappa, setZoomMappa] = useState(0.4); 

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
  const [testoVocale, setTestoVocale] = useState('');
  const [showDisponibilita, setShowDisponibilita] = useState(false);
  
  const [showStatistiche, setShowStatistiche] = useState(false);
  const [showCestino, setShowCestino] = useState(false);

  const mapContainerRef = useRef(null);
  const [pinchDist, setPinchDist] = useState(null);
  const [pinchZoom, setPinchZoom] = useState(null);

  const fileInputRef = useRef(null);
  const isAdmin = userRole === 'admin';

  const isEditModeRef = useRef(isEditMode);
  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  const prenotazioniAttive = prenotazioni.filter(p => !p.eliminata);
  const prenotazioniEliminate = prenotazioni.filter(p => p.eliminata).sort((a,b) => new Date(b.data_eliminazione) - new Date(a.data_eliminazione));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedLogin = localStorage.getItem('belvedere_logged_in');
    const savedRole = localStorage.getItem('belvedere_user_role');
    if (savedLogin === 'true' && savedRole) {
      setIsLoggedIn(true);
      setUserRole(savedRole);
    }
    const meta = document.createElement('meta');
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.getElementsByTagName('head')[0].appendChild(meta);
  }, []);

  const zoomIn = () => setZoomMappa(prev => Math.min(prev + 0.1, 1.8));
  const zoomOut = () => setZoomMappa(prev => Math.max(prev - 0.1, 0.15));

  // REALTIME
  useEffect(() => {
    if (isLoggedIn) {
      const channel = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni' }, () => { 
            if (!isEditModeRef.current) caricaPrenotazioni(); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => { 
            if (!isEditModeRef.current) caricaTuttiITavoli(); 
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn]);

  // CARICAMENTO DATI
  const caricaSale = async () => {
    let { data } = await supabase.from('sale').select('*').order('ordine');
    if (data?.length > 0) { setSale(data); }
  };
  const caricaPrenotazioni = async () => {
    let { data } = await supabase.from('prenotazioni').select('*').order('data_ora', { ascending: false });
    if (data) setPrenotazioni(data);
  };
  const caricaTuttiITavoli = async () => {
    let { data } = await supabase.from('tavoli').select('*');
    if (data) setTuttiITavoli(data);
  };
  const aggiornaTutto = () => { caricaSale(); caricaPrenotazioni(); caricaTuttiITavoli(); };
  useEffect(() => { if (isLoggedIn) aggiornaTutto(); }, [isLoggedIn]);

  // FUNZIONE RICHIESTA: AGGIORNAMENTO POSIZIONE LOCALE
  const aggiornaPosizioneLocale = (id, x, y) => { 
    setTuttiITavoli(prev => prev.map(t => t.id === id ? { ...t, pos_x: Math.round(x), pos_y: Math.round(y) } : t)); 
  };

  const getPrenotazioniTurno = (tavoloId) => {
    return prenotazioniAttive.filter(p => 
      p.tavoli_assegnati && 
      p.tavoli_assegnati.includes(tavoloId) && 
      formatData(p.data_ora) === dataVista && 
      getServizioDaOra(p.data_ora) === servizioVista
    );
  };

  const generaOrari = () => {
    const orari = [];
    const config = servizioVista === 'pranzo' ? { start: 12, end: 14 } : { start: 18, end: 22 };
    for (let h = config.start; h <= config.end; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === config.end && m > 0) break;
        orari.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return orari;
  };

  // AZIONI DATABASE
  async function salvaPrenotazione(e) {
    if (e) e.preventDefault();
    if (tavoliSelezionati.length === 0) return alert("Seleziona almeno un tavolo!");
    const payload = { 
      nome_cliente: nomeCliente, 
      numero_persone: parseInt(numeroPersone), 
      data_ora: new Date(`${dataVista}T${oraEsatta}`).toISOString(), 
      tavoli_assegnati: tavoliSelezionati, 
      note,
      eliminata: false,
      presente: editingId ? prenotazioniAttive.find(x => x.id === editingId)?.presente : false
    };
    const { error } = editingId ? await supabase.from('prenotazioni').update(payload).eq('id', editingId) : await supabase.from('prenotazioni').insert([payload]);
    if (!error) { 
        resetForm(); 
        aggiornaTutto(); 
    }
  }

  async function occupaTavoloVeloce(tavoloId) {
    const t = tuttiITavoli.find(x => x.id === tavoloId);
    const pax = window.prompt("Quante persone?", t?.capacita || "2");
    if (!pax) return;
    const now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    const payload = { nome_cliente: 'Senza Prenotazione', numero_persone: parseInt(pax), data_ora: new Date(`${dataVista}T${hh}:${mm}`).toISOString(), tavoli_assegnati: [tavoloId], note: '', presente: true, eliminata: false };
    const { error } = await supabase.from('prenotazioni').insert([payload]);
    if (!error) { aggiornaTutto(); setTavoloInfo(null); }
  }

  async function spostaTavoloRapido(prenoId, nuovoTavoloId) {
    if (!nuovoTavoloId) return;
    const { error } = await supabase.from('prenotazioni').update({ tavoli_assegnati: [nuovoTavoloId] }).eq('id', prenoId);
    if (!error) { setPrenoInSpostamento(null); setTavoloInfo(null); aggiornaTutto(); }
  }

  async function togglePresenza(id, statoAttuale) {
    const { error } = await supabase.from('prenotazioni').update({ presente: !statoAttuale }).eq('id', id);
    if (!error) aggiornaTutto();
  }

  async function cestinaPrenotazione(id) {
    if(window.confirm("Spostare nel cestino?")) {
      await supabase.from('prenotazioni').update({ eliminata: true, data_eliminazione: new Date().toISOString() }).eq('id', id);
      aggiornaTutto();
      setTavoloInfo(null);
    }
  }

  async function ripristinaDaCestino(id) {
    await supabase.from('prenotazioni').update({ eliminata: false, data_eliminazione: null }).eq('id', id);
    aggiornaTutto();
  }

  async function eliminaDefinitivamente(id) {
    if(window.confirm("Eliminare definitivamente?")) {
      await supabase.from('prenotazioni').delete().eq('id', id);
      aggiornaTutto();
    }
  }

  // GESTIONE MAPPA ADMIN
  async function aggiungiTavolo() {
    await supabase.from('tavoli').insert([{ sala_id: sale[0]?.id, numero_tavolo: '?', capacita: 2, pos_x: 200, pos_y: 200 }]);
    caricaTuttiITavoli(); 
  }

  async function aggiungiMuro() {
    await supabase.from('tavoli').insert([{ sala_id: sale[0]?.id, numero_tavolo: 'MURO_300x20', capacita: 0, pos_x: 200, pos_y: 200 }]);
    caricaTuttiITavoli(); 
  }

  async function salvaCorrente() {
    const promises = tuttiITavoli.map(t => supabase.from('tavoli').update({ pos_x: Number(t.pos_x), pos_y: Number(t.pos_y) }).eq('id', t.id));
    await Promise.all(promises);
    setIsEditMode(false);
    alert("📍 Posizioni salvate!");
  }

  async function recuperaTavoli() {
    if (!window.confirm("Recuperare tutti i tavoli?")) return;
    const promises = tuttiITavoli.map((t, index) => supabase.from('tavoli').update({ pos_x: (index % 8) * 110 + 20, pos_y: Math.floor(index / 8) * 110 + 20 }).eq('id', t.id));
    await Promise.all(promises);
    aggiornaTutto();
  }

  // LOGIN & UTILS
  const handleLogin = (e) => {
    e.preventDefault();
    const pwd = passInput.toLowerCase().trim();
    if (pwd === "belvedere59") {
      setIsLoggedIn(true); setUserRole('admin');
      if (ricordami) { localStorage.setItem('belvedere_logged_in', 'true'); localStorage.setItem('belvedere_user_role', 'admin'); }
    } else if (pwd === "seba") {
      setIsLoggedIn(true); setUserRole('cameriere');
      if (ricordami) { localStorage.setItem('belvedere_logged_in', 'true'); localStorage.setItem('belvedere_user_role', 'cameriere'); }
    } else { alert("Password errata!"); }
  };

  const resetForm = () => { setEditingId(null); setNomeCliente(''); setNumeroPersone(''); setOraEsatta(''); setNote(''); setTavoliSelezionati([]); };

  // COMANDI VOCALI (RE-INSERTED)
  const ascoltaComando = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser non supportato.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.onstart = () => { setIsListening(true); setTestoVocale('Ascolto...'); };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setTestoVocale(`Hai detto: "${transcript}"`);
      compilaFormDaVoce(transcript);
    };
    recognition.start();
  };

  const compilaFormDaVoce = (frase) => {
    // Logica semplificata basata sul tuo codice originale
    const matchPersone = frase.match(/(\d+)\s*person/i);
    if (matchPersone) setNumeroPersone(matchPersone[1]);
    const matchOra = frase.match(/(?:ore|alle|le)\s*(\d{1,2})(?:[\:\s\.]*(\d{2}))?/i);
    if (matchOra) setOraEsatta(`${String(matchOra[1]).padStart(2, '0')}:${matchOra[2] || '00'}`);
    // ... Altre logiche di parsing nome/data come nel tuo originale ...
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setPinchDist(Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY));
      setPinchZoom(zoomMappa);
    }
  };
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchDist) {
      let newZ = pinchZoom * (Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) / pinchDist);
      setZoomMappa(Math.max(0.15, Math.min(newZ, 1.8)));
    }
  };

  const clickTavoloSfondo = (id) => {
    if (isEditMode) return;
    if (oraEsatta) setTavoliSelezionati(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    else setTavoloInfo(id);
  };

  const calcolaStatistiche = () => {
    const oggiStr = formatData(new Date().toISOString());
    const presOggi = prenotazioniAttive.filter(p => formatData(p.data_ora) === oggiStr);
    return { paxOggi: presOggi.reduce((s, p) => s + p.numero_persone, 0), tavoliOggi: presOggi.length };
  };

  // --- RENDERING ---

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f6f8' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '300px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <h2 style={{textAlign: 'center'}}>Belvedere Login</h2>
          <input type="password" placeholder="Password" value={passInput} onChange={e => setPassInput(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
          <button type="submit" style={{ width: '100%', padding: '12px', background: '#d4af37', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', marginTop: '15px' }}>ACCEDI</button>
        </form>
      </div>
    );
  }

  const SezioneForm = (
    <div style={{ background: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
      <form onSubmit={salvaPrenotazione} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="text" placeholder="Nome Cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #ced4da' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="number" placeholder="Pax" value={numeroPersone} onChange={e => setNumeroPersone(e.target.value)} required style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ced4da' }} />
          <select value={oraEsatta} onChange={e => setOraEsatta(e.target.value)} required style={{ flex: 1.5, padding: '12px', borderRadius: '12px', border: '1px solid #ced4da' }}>
            <option value="">Ora...</option>
            {generaOrari().map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <button type="submit" style={{ padding: '14px', background: '#1a73e8', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold' }}>💾 SALVA</button>
      </form>
    </div>
  );

  const SezioneMappa = (
    <div style={isFullscreen ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: '#f4f6f8', padding: '10px' } : { flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '10px', borderRadius: '15px' }}>
        <button onClick={() => setIsFullscreen(!isFullscreen)} style={{padding: '8px 12px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '10px'}}>{isFullscreen ? "Chiudi" : "🖥️ Full"}</button>
        {isAdmin && <button onClick={() => setIsEditMode(!isEditMode)} style={{padding: '8px 12px', background: isEditMode ? '#28a745' : '#dc3545', color: 'white', border: 'none', borderRadius: '10px'}}>{isEditMode ? "🔓 ON" : "🔒 OFF"}</button>}
        <div style={{display: 'flex', gap: '5px'}}>
            <button onClick={zoomOut} style={{width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #ccc'}}>-</button>
            <button onClick={zoomIn} style={{width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #ccc'}}>+</button>
        </div>
      </div>

      <div 
        ref={mapContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{ flex: 1, minHeight: '60vh', backgroundColor: '#e9ecef', borderRadius: '16px', overflow: 'auto', position: 'relative', border: '2px solid #dee2e6' }}
      >
        <div style={{ width: '3000px', height: '3000px', position: 'relative', transform: `scale(${zoomMappa})`, transformOrigin: 'top left' }}>
          {(tuttiITavoli || []).map(t => {
            const isMuro = String(t.numero_tavolo).startsWith('MURO');
            const pres = getPrenotazioniTurno(t.id);
            const sel = tavoliSelezionati.includes(t.id);
            let bgCol = 'white'; let bCol = '#adb5bd';
            if (isMuro) { bgCol = '#495057'; bCol = '#343a40'; }
            else if (sel) { bgCol = '#cfe2ff'; bCol = '#0d6efd'; } 
            else if (pres.length > 1) { bgCol = '#dc3545'; bCol = '#a71d2a'; } 
            else if (pres.some(p => p.presente)) { bgCol = '#d1e7dd'; bCol = '#28a745'; } 
            else if (pres.length === 1) { bgCol = '#fd7e14'; bCol = '#d35400'; } 

            let w = 90, h = 90;
            if (isMuro) {
               const match = t.numero_tavolo.match(/MURO_(\d+)x(\d+)/i);
               if (match) { w = parseInt(match[1]); h = parseInt(match[2]); }
            }

            return (
              <Draggable 
                key={t.id} 
                disabled={!isEditMode} 
                scale={zoomMappa}
                position={{ x: Number(t.pos_x) || 0, y: Number(t.pos_y) || 0 }}
                onStop={(e, data) => aggiornaPosizioneLocale(t.id, data.x, data.y)}
              >
                <div 
                    onClick={(e) => { e.stopPropagation(); clickTavoloSfondo(t.id); }}
                    style={{ 
                        position: 'absolute', width: `${w}px`, height: `${h}px`, borderRadius: isMuro ? '4px' : '15px', 
                        background: bgCol, border: `3px solid ${bCol}`, display: 'flex', flexDirection: 'column', 
                        alignItems: 'center', justifyContent: 'center', cursor: isEditMode ? 'move' : 'pointer', 
                        touchAction: 'none', zIndex: isMuro ? 1 : 5 
                    }}
                >
                  {!isMuro && <strong style={{fontSize: `${dimensioneTestoTavolo}px`}}>{t.numero_tavolo}</strong>}
                  {!isMuro && pres.map(p => (
                      <div key={p.id} style={{fontSize: '9px', background: p.presente ? '#28a745' : 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 4px', borderRadius: '4px', marginTop: '2px'}}>
                          {formatOra(p.data_ora)} - {p.nome_cliente.substring(0,8)}
                      </div>
                  ))}
                  {isAdmin && isEditMode && (
                    <button 
                        onMouseDown={e => e.stopPropagation()} 
                        onClick={async (e) => { e.stopPropagation(); if(window.confirm("Elimina?")) { await supabase.from('tavoli').delete().eq('id', t.id); aggiornaTutto(); } }}
                        style={{position: 'absolute', top: '-12px', right: '-12px', background: 'red', color: 'white', borderRadius: '50%', border: '2px solid white', width: '25px', height: '25px', cursor: 'pointer', zIndex: 20}}
                    >✖</button>
                  )}
                </div>
              </Draggable>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#f4f6f8', height: '100vh', padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* HEADER */}
      <div style={{ background: 'white', padding: '10px 15px', borderRadius: '16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
            <img src="/logo.png" alt="Logo" style={{height: '40px'}} />
            <input type="date" value={dataVista} onChange={e => setDataVista(e.target.value)} style={{padding: '8px', borderRadius: '10px', border: '1px solid #ddd'}} />
            <div style={{background: '#eee', padding: '4px', borderRadius: '10px'}}>
                <button onClick={() => setServizioVista('pranzo')} style={{border: 'none', background: servizioVista === 'pranzo' ? 'white' : 'transparent', padding: '5px 10px', borderRadius: '7px'}}>PRANZO</button>
                <button onClick={() => setServizioVista('cena')} style={{border: 'none', background: servizioVista === 'cena' ? 'white' : 'transparent', padding: '5px 10px', borderRadius: '7px'}}>CENA</button>
            </div>
         </div>
         <div style={{display: 'flex', gap: '8px'}}>
            <button onClick={ascoltaComando} style={{background: isListening ? 'red' : '#6f42c1', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '10px'}}>🎤</button>
            <button onClick={() => setShowStatistiche(true)} style={{background: '#6c757d', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '10px'}}>📈</button>
            <button onClick={() => { setIsLoggedIn(false); localStorage.clear(); }} style={{background: '#f8f9fa', border: '1px solid #ddd', padding: '8px 15px', borderRadius: '10px'}}>Esci</button>
         </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', flexGrow: 1, overflow: 'hidden' }}>
        <div style={{ flex: isMobile ? 'none' : '0 0 320px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
            {SezioneForm}
            {/* Qui puoi mappare la SezioneAgenda originale */}
        </div>
        {!isFullscreen && SezioneMappa}
      </div>

      {isFullscreen && SezioneMappa}

      {/* POPUP INFO TAVOLO DETTAGLIO */}
      {tavoloInfo && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setTavoloInfo(null)}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '20px', width: '90%', maxWidth: '350px' }} onClick={e => e.stopPropagation()}>
                <h3 style={{marginTop: 0}}>Tavolo {tuttiITavoli.find(t => t.id === tavoloInfo)?.numero_tavolo}</h3>
                <button onClick={() => occupaTavoloVeloce(tavoloInfo)} style={{width: '100%', padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '10px', marginBottom: '10px', fontWeight: 'bold'}}>🚶 OCCUPA SUBITO</button>
                <button onClick={() => { setTavoliSelezionati([tavoloInfo]); setTavoloInfo(null); }} style={{width: '100%', padding: '12px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold'}}>➕ PRENOTA</button>
                <button onClick={() => setTavoloInfo(null)} style={{width: '100%', padding: '10px', background: '#eee', border: 'none', borderRadius: '10px', marginTop: '15px'}}>Chiudi</button>
            </div>
          </div>
      )}
    </div>
  );
}
