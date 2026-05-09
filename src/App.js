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
  useEffect(() => { isEditModeRef.current = isEditMode; }, [isEditMode]);

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

  const zoomIn = () => setZoomMappa(prev => Math.min(prev + 0.1, 1.8));
  const zoomOut = () => setZoomMappa(prev => Math.max(prev - 0.1, 0.15));

  const caricaSale = async () => {
    let { data } = await supabase.from('sale').select('*').order('ordine');
    if (data) setSale(data);
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

  const aggiornaPosizioneLocale = (id, x, y) => { 
    setTuttiITavoli(prev => prev.map(t => t.id === id ? { ...t, pos_x: Math.round(x), pos_y: Math.round(y) } : t)); 
  };

  const salvaCorrente = async () => {
    const promises = tuttiITavoli.map(t => supabase.from('tavoli').update({ pos_x: t.pos_x, pos_y: t.pos_y }).eq('id', t.id));
    await Promise.all(promises);
    setIsEditMode(false);
    alert("📍 Posizioni salvate!");
  };

  async function occupaTavoloVeloce(tavoloId) {
    const t = tuttiITavoli.find(x => x.id === tavoloId);
    const pax = window.prompt("Quante persone?", t?.capacita || "2");
    if (!pax) return;
    const now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    const payload = { nome_cliente: 'Senza Prenotazione', numero_persone: parseInt(pax), data_ora: new Date(`${dataVista}T${hh}:${mm}`).toISOString(), tavoli_assegnati: [tavoloId], presente: true, eliminata: false };
    const { error } = await supabase.from('prenotazioni').insert([payload]);
    if (!error) { aggiornaTutto(); setTavoloInfo(null); }
  }

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

  const clickTavoloSfondo = (id) => {
    if (isEditMode) return;
    if (oraEsatta) setTavoliSelezionati(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    else setTavoloInfo(id);
  };

  const getPrenotazioniTurno = (tavoloId) => {
    return prenotazioniAttive.filter(p => 
      p.tavoli_assegnati?.includes(tavoloId) && 
      formatData(p.data_ora) === dataVista && 
      getServizioDaOra(p.data_ora) === servizioVista
    );
  };

  // --- SEZIONE MAPPA ---
  const SezioneMappa = (
    <div style={isFullscreen ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: '#f4f6f8', padding: '15px' } : { flex: 1, position: 'relative' }}>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', background: 'white', padding: '10px', borderRadius: '12px' }}>
        <button onClick={() => setIsFullscreen(!isFullscreen)} style={{ padding: '8px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px' }}>
            {isFullscreen ? "Esci Fullscreen" : "🖥️ Fullscreen"}
        </button>
        {isAdmin && (
          <button onClick={() => setIsEditMode(!isEditMode)} style={{ padding: '8px', background: isEditMode ? '#28a745' : '#dc3545', color: 'white', border: 'none', borderRadius: '8px' }}>
            {isEditMode ? "Blocca Mappa" : "Sblocca Mappa"}
          </button>
        )}
        {isEditMode && <button onClick={salvaCorrente} style={{ padding: '8px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px' }}>💾 Salva</button>}
      </div>

      <div ref={mapContainerRef} style={{ width: '100%', height: '70vh', backgroundColor: '#e9ecef', borderRadius: '16px', overflow: 'auto', position: 'relative', border: '2px solid #ddd' }}>
        <div style={{ width: '3000px', height: '3000px', position: 'relative', transform: `scale(${zoomMappa})`, transformOrigin: 'top left' }}>
          {tuttiITavoli.map(t => {
            const isMuro = String(t.numero_tavolo).startsWith('MURO');
            const pres = getPrenotazioniTurno(t.id);
            const sel = tavoliSelezionati.includes(t.id);
            
            let bgCol = isMuro ? '#495057' : 'white';
            let bCol = '#adb5bd';
            if (!isMuro) {
                if (sel) { bgCol = '#cfe2ff'; bCol = '#0d6efd'; }
                else if (pres.length > 1) { bgCol = '#dc3545'; bCol = '#a71d2a'; }
                else if (pres.some(p => p.presente)) { bgCol = '#d1e7dd'; bCol = '#28a745'; }
                else if (pres.length === 1) { bgCol = '#fd7e14'; bCol = '#d35400'; }
            }

            return (
              <Draggable
                key={t.id}
                disabled={!isEditMode}
                scale={zoomMappa}
                position={{ x: t.pos_x || 0, y: t.pos_y || 0 }}
                onStop={(e, data) => aggiornaPosizioneLocale(t.id, data.x, data.y)}
              >
                <div 
                  onClick={() => clickTavoloSfondo(t.id)}
                  style={{
                    position: 'absolute',
                    width: isMuro ? '200px' : '90px',
                    height: isMuro ? '20px' : '90px',
                    backgroundColor: bgCol,
                    border: `3px solid ${bCol}`,
                    borderRadius: isMuro ? '4px' : '15px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isEditMode ? 'move' : 'pointer',
                    zIndex: isMuro ? 1 : 10,
                    touchAction: 'none'
                  }}
                >
                  {!isMuro && <strong style={{fontSize: '18px'}}>{t.numero_tavolo}</strong>}
                  {!isMuro && pres.map(p => (
                    <div key={p.id} style={{fontSize: '9px', background: 'black', color: 'white', padding: '1px 4px', borderRadius: '4px', marginTop: '2px'}}>
                      {formatOra(p.data_ora)} {p.nome_cliente.substring(0,8)}
                    </div>
                  ))}
                  {isEditMode && isAdmin && (
                      <button 
                        onMouseDown={e => e.stopPropagation()} 
                        onClick={async (e) => { e.stopPropagation(); if(window.confirm("Elimina?")) { await supabase.from('tavoli').delete().eq('id', t.id); aggiornaTutto(); } }}
                        style={{position: 'absolute', top: '-10px', right: '-10px', background: 'red', color: 'white', borderRadius: '50%', border: 'none', width: '20px', height: '20px', cursor: 'pointer'}}
                      >X</button>
                  )}
                </div>
              </Draggable>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f6f8' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '300px', textAlign: 'center' }}>
          <h2>Login Belvedere</h2>
          <input type="password" placeholder="Password" value={passInput} onChange={e => setPassInput(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px' }} />
          <button type="submit" style={{ width: '100%', padding: '12px', background: '#d4af37', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>ENTRA</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px', fontFamily: 'sans-serif', backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: 'white', padding: '15px', borderRadius: '15px' }}>
         <h1 style={{margin: 0, fontSize: '20px'}}>Belvedere Manager</h1>
         <div style={{display: 'flex', gap: '10px'}}>
            <input type="date" value={dataVista} onChange={e => setDataVista(e.target.value)} />
            <select value={servizioVista} onChange={e => setServizioVista(e.target.value)}>
                <option value="pranzo">Pranzo</option>
                <option value="cena">Cena</option>
            </select>
            <button onClick={() => { setIsLoggedIn(false); localStorage.clear(); }}>Esci</button>
         </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
        <div style={{ flex: isMobile ? '1' : '0 0 350px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{background: 'white', padding: '15px', borderRadius: '15px'}}>
                <h3>Nuova Prenotazione</h3>
                <input style={{width: '100%', marginBottom: '10px'}} placeholder="Nome Cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
                <input style={{width: '100%', marginBottom: '10px'}} type="number" placeholder="Persone" value={numeroPersone} onChange={e => setNumeroPersone(e.target.value)} />
                <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px'}}>
                    {tavoliSelezionati.map(id => (
                        <span key={id} style={{background: '#1a73e8', color: 'white', padding: '4px 8px', borderRadius: '5px'}}>
                            Tav. {tuttiITavoli.find(t => t.id === id)?.numero_tavolo}
                        </span>
                    ))}
                </div>
            </div>
        </div>
        
        {SezioneMappa}
      </div>

      {/* Pop-up Info Tavolo */}
      {tavoloInfo && (
          <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center'}} onClick={() => setTavoloInfo(null)}>
              <div style={{background: 'white', padding: '20px', borderRadius: '15px', width: '300px'}} onClick={e => e.stopPropagation()}>
                  <h3>Tavolo {tuttiITavoli.find(t => t.id === tavoloInfo)?.numero_tavolo}</h3>
                  <button onClick={() => occupaTavoloVeloce(tavoloInfo)} style={{width: '100%', padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', marginBottom: '10px'}}>Occupazione Veloce</button>
                  <button onClick={() => { setTavoliSelezionati([tavoloInfo]); setTavoloInfo(null); }} style={{width: '100%', padding: '10px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px'}}>Seleziona per Prenotazione</button>
                  <button onClick={() => setTavoloInfo(null)} style={{width: '100%', marginTop: '10px'}}>Chiudi</button>
              </div>
          </div>
      )}
    </div>
  );
}
