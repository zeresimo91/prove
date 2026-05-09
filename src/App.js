import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Draggable from 'react-draggable';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const formatData = (isoString) => {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatOra = (isoString) => new Date(isoString).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const getServizioDaOra = (isoString) => new Date(isoString).getHours() < 16 ? 'pranzo' : 'cena';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [sale, setSale] = useState([]);
  const [salaAttiva, setSalaAttiva] = useState(null);
  const [tavoli, setTavoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [dataVista, setDataVista] = useState(formatData(new Date().toISOString()));
  const [servizioVista, setServizioVista] = useState(new Date().getHours() < 16 ? 'pranzo' : 'cena');
  const [dimensioneTestoTavolo, setDimensioneTestoTavolo] = useState(18);
  const [dimensioneTestoCliente, setDimensioneTestoCliente] = useState(10);
  const [nomeCliente, setNomeCliente] = useState('');
  const [numeroPersone, setNumeroPersone] = useState('');
  const [oraEsatta, setOraEsatta] = useState('');
  const [tavoliSelezionati, setTavoliSelezionati] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { if (isLoggedIn) { caricaSale(); caricaPrenotazioni(); } }, [isLoggedIn]);
  async function caricaSale() {
    let { data } = await supabase.from('sale').select('*').order('ordine');
    if (data && data.length > 0) { setSale(data); setSalaAttiva(data[0].id); }
  }
  async function caricaPrenotazioni() {
    let { data } = await supabase.from('prenotazioni').select('*').order('data_ora', { ascending: true });
    if (data) setPrenotazioni(data);
  }
  useEffect(() => { if (salaAttiva && isLoggedIn) caricaTavoli(); }, [salaAttiva, isLoggedIn]);
  async function caricaTavoli() {
    let { data } = await supabase.from('tavoli').select('*').eq('sala_id', salaAttiva);
    if (data) setTavoli(data);
  }

  const handleLogin = (e) => {
    e.preventDefault();
    if (passInput === "Seba") setIsLoggedIn(true);
    else alert("Password errata!");
  };

  const getPrenotazioniTurno = (tavoloId) => {
    return prenotazioni.filter(p => 
      p.tavoli_assegnati.includes(tavoloId) && 
      formatData(p.data_ora) === dataVista && 
      getServizioDaOra(p.data_ora) === servizioVista
    );
  };

  const getPrenotazioneSovrapposta = (tavoloId) => {
    const targetInizio = new Date(`${dataVista}T${oraEsatta}`).getTime();
    const targetFine = targetInizio + (1 * 60 * 60 * 1000); 
    return prenotazioni.find(p => {
      if (p.id === editingId || !p.tavoli_assegnati.includes(tavoloId)) return false;
      const pInizio = new Date(p.data_ora).getTime();
      const pFine = pInizio + (1 * 60 * 60 * 1000); 
      return (targetInizio < pFine) && (targetFine > pInizio);
    });
  };

  const toggleSelezioneTavolo = (id) => {
    if (!oraEsatta) return alert("Inserisci l'orario!");
    const sov = getPrenotazioneSovrapposta(id);
    if (sov) return alert(`Occupato da ${sov.nome_cliente}`);
    setTavoliSelezionati(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  async function salvaPrenotazione(e) {
    if (e) e.preventDefault();
    if (tavoliSelezionati.length === 0) return alert("Seleziona i tavoli!");
    const payload = {
      nome_cliente: nomeCliente,
      numero_persone: parseInt(numeroPersone),
      data_ora: new Date(`${dataVista}T${oraEsatta}`).toISOString(),
      tavoli_assegnati: tavoliSelezionati
    };
    let res = editingId ? await supabase.from('prenotazioni').update(payload).eq('id', editingId) : await supabase.from('prenotazioni').insert([payload]);
    if (!res.error) { resetForm(); caricaPrenotazioni(); }
  }

  async function salvaDisposizione() {
    if (!window.confirm("Salvare posizione tavoli?")) return;
    const promises = tavoli.map(t => supabase.from('tavoli').update({ pos_x: t.pos_x, pos_y: t.pos_y }).eq('id', t.id));
    await Promise.all(promises);
    alert("📍 Posizioni salvate!");
  }

  const aggiornaPosizioneLocale = (id, x, y) => {
    setTavoli(prev => prev.map(t => t.id === id ? { ...t, pos_x: Math.round(x), pos_y: Math.round(y) } : t));
  };

  const resetForm = () => { setEditingId(null); setNomeCliente(''); setNumeroPersone(''); setOraEsatta(''); setTavoliSelezionati([]); };

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f4f8' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '30px', borderRadius: '15px', textAlign: 'center', width: '90%', maxWidth: '400px' }}>
          <h2>Belvedere 🍷</h2>
          <input type="password" placeholder="Password" value={passInput} onChange={e => setPassInput(e.target.value)} style={{ padding: '15px', width: '100%', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '15px', boxSizing: 'border-box' }} />
          <button type="submit" style={{ padding: '15px', width: '100%', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Entra</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f0f4f8', minHeight: '100vh', padding: '10px' }}>
      
      {/* Header adattivo */}
      <div style={{ background: 'white', padding: '15px', borderRadius: '15px', marginBottom: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', textAlign: 'center' }}>Belvedere Smart Planner 🍷</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
          <input type="date" value={dataVista} onChange={e => setDataVista(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
          <div style={{ background: '#eee', borderRadius: '10px', padding: '3px', display: 'flex' }}>
            <button onClick={() => setServizioVista('pranzo')} style={{ padding: '8px 15px', border: 'none', borderRadius: '7px', background: servizioVista === 'pranzo' ? 'white' : 'transparent', fontWeight: 'bold' }}>☀️</button>
            <button onClick={() => setServizioVista('cena')} style={{ padding: '8px 15px', border: 'none', borderRadius: '7px', background: servizioVista === 'cena' ? 'white' : 'transparent', fontWeight: 'bold' }}>🌙</button>
          </div>
          <button onClick={() => setIsLoggedIn(false)} style={{ padding: '8px', background: '#ddd', border: 'none', borderRadius: '8px' }}>Esci</button>
        </div>
      </div>

      <div className="main-container" style={{ display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', gap: '15px' }}>
        
        {/* Pannello Input */}
        <div style={{ width: window.innerWidth < 768 ? '100%' : '350px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ background: 'white', padding: '15px', borderRadius: '15px' }}>
            <form onSubmit={salvaPrenotazione} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" placeholder="Nome Cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <div style={{ display: 'flex', gap: '5px' }}>
                <input type="number" placeholder="Pax" value={numeroPersone} onChange={e => setNumeroPersone(e.target.value)} required style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }} />
                <input type="time" value={oraEsatta} onChange={e => setOraEsatta(e.target.value)} required style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }} />
              </div>
              <button type="submit" style={{ padding: '12px', background: '#1a73e8', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>Salva Prenotazione</button>
            </form>
          </div>

          <div style={{ background: 'white', padding: '15px', borderRadius: '15px', maxHeight: '200px', overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Arrivi {servizioVista}</h4>
            {prenotazioni.filter(p => formatData(p.data_ora) === dataVista && getServizioDaOra(p.data_ora) === servizioVista).map(p => (
              <div key={p.id} style={{ fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                <span>{formatOra(p.data_ora)} - <b>{p.nome_cliente}</b></span>
                <button onClick={async () => { if(window.confirm("Elimino?")) { await supabase.from('prenotazioni').delete().eq('id', p.id); caricaPrenotazioni(); } }} style={{ color: 'red', border: 'none', background: 'none' }}>🗑️</button>
              </div>
            ))}
          </div>
        </div>

        {/* Sala / Mappa */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
            {sale.map(s => (
              <button key={s.id} onClick={() => setSalaAttiva(s.id)} style={{ padding: '8px 15px', borderRadius: '10px', whiteSpace: 'nowrap', background: salaAttiva === s.id ? '#333' : '#fff', color: salaAttiva === s.id ? '#fff' : '#333', border: 'none' }}>{s.nome}</button>
            ))}
            <button onClick={salvaDisposizione} style={{ background: '#ff9800', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 15px' }}>📍</button>
          </div>

          {/* Area Mappa con Scroll orizzontale su Mobile */}
          <div style={{ 
            width: '100%', 
            height: '60vh', 
            backgroundColor: 'white', 
            borderRadius: '15px', 
            position: 'relative', 
            border: '1px solid #ddd', 
            overflow: 'auto', // Permette lo scroll se i tavoli sono fuori
            backgroundImage: 'radial-gradient(#ddd 0.5px, transparent 0.5px)', 
            backgroundSize: '20px 20px' 
          }}>
            <div style={{ minWidth: '800px', height: '100%', position: 'relative' }}>
              {tavoli.map(t => {
                const pres = getPrenotazioniTurno(t.id);
                const sel = tavoliSelezionati.includes(t.id);
                return (
                  <Draggable key={t.id} position={{ x: t.pos_x, y: t.pos_y }} onStop={(e, d) => aggiornaPosizioneLocale(t.id, d.x, d.y)} bounds="parent">
                    <div onClick={() => toggleSelezioneTavolo(t.id)} style={{
                      position: 'absolute', width: '80px', height: '80px', borderRadius: '10px',
                      background: sel ? '#d1e7ff' : (pres.length > 0 ? '#fff5f5' : '#fff'),
                      border: `2px solid ${sel ? '#1a73e8' : (pres.length > 0 ? '#ffcccc' : '#ccc')}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', textAlign: 'center', padding: '5px'
                    }}>
                      <strong style={{ fontSize: `${dimensioneTestoTavolo}px` }}>{t.numero_tavolo}</strong>
                      {pres.map(p => (
                        <div key={p.id} style={{ fontSize: `${dimensioneTestoCliente}px`, background: '#ea4335', color: 'white', padding: '1px 3px', borderRadius: '3px', marginTop: '2px', width: '90%', overflow: 'hidden' }}>
                          {p.nome_cliente}
                        </div>
                      ))}
                    </div>
                  </Draggable>
                );
              })}
            </div>
          </div>
          
          {/* Slider Testo visibili anche su mobile in basso */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', background: 'white', padding: '10px', borderRadius: '10px', fontSize: '12px' }}>
            Tavolo: <input type="range" min="10" max="30" value={dimensioneTestoTavolo} onChange={e => setDimensioneTestoTavolo(e.target.value)} />
            Nome: <input type="range" min="8" max="15" value={dimensioneTestoCliente} onChange={e => setDimensioneTestoCliente(e.target.value)} />
          </div>
        </div>

      </div>
      
      {/* Tasto Salvataggio Rapido Mobile */}
      {nomeCliente && oraEsatta && tavoliSelezionati.length > 0 && (
        <button onClick={salvaPrenotazione} style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '15px 25px', background: '#28a745', color: 'white', borderRadius: '50px', border: 'none', fontWeight: 'bold', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', zIndex: 1000 }}>
          💾 SALVA
        </button>
      )}
    </div>
  );
}