import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Draggable from 'react-draggable';

// SICUREZZA: Le chiavi ora vengono lette dalle variabili d'ambiente di Vercel
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Utility di formattazione
const formatData = (isoString) => {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatOra = (isoString) => new Date(isoString).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const getServizioDaOra = (isoString) => new Date(isoString).getHours() < 16 ? 'pranzo' : 'cena';

export default function App() {
  // Stato Sicurezza
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passInput, setPassInput] = useState('');

  // Stato Dati
  const [sale, setSale] = useState([]);
  const [salaAttiva, setSalaAttiva] = useState(null);
  const [tavoli, setTavoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  
  // Stato Interfaccia
  const [dataVista, setDataVista] = useState(formatData(new Date().toISOString()));
  const [servizioVista, setServizioVista] = useState(new Date().getHours() < 16 ? 'pranzo' : 'cena');
  const [dimensioneTestoTavolo, setDimensioneTestoTavolo] = useState(20);
  const [dimensioneTestoCliente, setDimensioneTestoCliente] = useState(10);

  // Stato Form Prenotazione
  const [nomeCliente, setNomeCliente] = useState('');
  const [numeroPersone, setNumeroPersone] = useState('');
  const [oraEsatta, setOraEsatta] = useState('');
  const [tavoliSelezionati, setTavoliSelezionati] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (isLoggedIn) {
      caricaSale();
      caricaPrenotazioni();
    }
  }, [isLoggedIn]);

  async function caricaSale() {
    let { data } = await supabase.from('sale').select('*').order('ordine');
    if (data && data.length > 0) { setSale(data); setSalaAttiva(data[0].id); }
  }

  async function caricaPrenotazioni() {
    let { data } = await supabase.from('prenotazioni').select('*').order('data_ora', { ascending: true });
    if (data) setPrenotazioni(data);
  }

  useEffect(() => {
    if (salaAttiva && isLoggedIn) caricaTavoli();
  }, [salaAttiva, isLoggedIn]);

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

  // LOGICA 1 ORA (60 minuti)
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
    if (!oraEsatta) return alert("Inserisci prima l'orario a sinistra!");
    const sovrapposizione = getPrenotazioneSovrapposta(id);
    if (sovrapposizione) return alert(`Tavolo occupato da ${sovrapposizione.nome_cliente} (Ore ${formatOra(sovrapposizione.data_ora)}). Attendi un'ora.`);
    setTavoliSelezionati(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  // SALVATAGGIO PRENOTAZIONE
  async function salvaPrenotazione(e) {
    if (e) e.preventDefault(); 
    if (tavoliSelezionati.length === 0) return alert("Seleziona almeno un tavolo sulla mappa!");
    if (!nomeCliente || !numeroPersone || !oraEsatta) return alert("Compila tutti i dati della prenotazione!");

    const payload = {
      nome_cliente: nomeCliente,
      numero_persone: parseInt(numeroPersone),
      data_ora: new Date(`${dataVista}T${oraEsatta}`).toISOString(),
      tavoli_assegnati: tavoliSelezionati
    };

    let res = editingId ? await supabase.from('prenotazioni').update(payload).eq('id', editingId) : await supabase.from('prenotazioni').insert([payload]);
    
    if (!res.error) {
      resetForm();
      caricaPrenotazioni();
    } else {
      alert("Errore nel salvataggio. Riprova.");
    }
  }

  // SALVATAGGIO DISPOSIZIONE TAVOLI
  async function salvaDisposizione() {
    if (!window.confirm("Vuoi confermare la posizione fissa di questi tavoli in sala?")) return;
    const promises = tavoli.map(t => supabase.from('tavoli').update({ pos_x: t.pos_x, pos_y: t.pos_y }).eq('id', t.id));
    await Promise.all(promises);
    alert("📍 Disposizione sala aggiornata!");
  }

  const aggiornaPosizioneLocale = (id, x, y) => {
    setTavoli(prev => prev.map(t => t.id === id ? { ...t, pos_x: Math.round(x), pos_y: Math.round(y) } : t));
  };

  const resetForm = () => { setEditingId(null); setNomeCliente(''); setNumeroPersone(''); setOraEsatta(''); setTavoliSelezionati([]); };

  async function modificaInfoTavolo(t) {
    const nuovoNumero = window.prompt("Nome tavolo:", t.numero_tavolo);
    const nuoviPax = window.prompt("Posti a sedere:", t.capacita);
    if (nuovoNumero && nuoviPax) {
      await supabase.from('tavoli').update({ numero_tavolo: nuovoNumero, capacita: parseInt(nuoviPax) }).eq('id', t.id);
      caricaTavoli();
    }
  }

  const prontoPerSalvare = tavoliSelezionati.length > 0 && nomeCliente !== '' && numeroPersone !== '' && oraEsatta !== '';

  // SCHERMATA LOGIN
  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f4f8', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '20px' }}>Accesso Belvedere 🍷</h2>
          <input type="password" placeholder="Inserisci Password" value={passInput} onChange={e => setPassInput(e.target.value)} style={{ padding: '12px', width: '250px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '15px', display: 'block' }} />
          <button type="submit" style={{ padding: '12px 30px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Entra</button>
        </form>
      </div>
    );
  }

  // APP PRINCIPALE
  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', padding: '20px', backgroundColor: '#f0f4f8', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: 'white', padding: '15px 25px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>Belvedere Smart Planner 🍷</h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <input type="date" value={dataVista} onChange={e => setDataVista(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontWeight: 'bold' }} />
          <div style={{ display: 'flex', background: '#eee', borderRadius: '10px', padding: '4px' }}>
            <button onClick={() => setServizioVista('pranzo')} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', background: servizioVista === 'pranzo' ? 'white' : 'transparent', fontWeight: 'bold', cursor: 'pointer' }}>☀️ Pranzo</button>
            <button onClick={() => setServizioVista('cena')} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', background: servizioVista === 'cena' ? 'white' : 'transparent', fontWeight: 'bold', cursor: 'pointer' }}>🌙 Cena</button>
          </div>
          <button onClick={() => setIsLoggedIn(false)} style={{ background: '#eee', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Esci</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        
        {/* COLONNA SINISTRA */}
        <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Form */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <h3 style={{ marginTop: 0, color: '#1a73e8' }}>{editingId ? "✏️ Modifica" : "➕ Nuova"} Prenotazione</h3>
            <form onSubmit={salvaPrenotazione} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Nome Cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="number" placeholder="Pax" value={numeroPersone} onChange={e => setNumeroPersone(e.target.value)} required style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
                <input type="time" value={oraEsatta} onChange={e => setOraEsatta(e.target.value)} required style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontWeight: 'bold', color: '#ea4335' }} />
              </div>
              <div style={{ fontSize: '13px', background: tavoliSelezionati.length > 0 ? '#d1e7ff' : '#f8f9ff', padding: '10px', borderRadius: '8px', color: '#1a73e8', fontWeight: 'bold', border: '1px dashed #1a73e8', transition: '0.3s' }}>
                Tavoli: {tavoliSelezionati.length > 0 ? tavoliSelezionati.length : "Cliccali sulla mappa"}
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Salva Info</button>
                {editingId && <button type="button" onClick={resetForm} style={{ padding: '12px', background: '#ccc', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>}
              </div>
            </form>
          </div>

          {/* Agenda */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', flex: 1 }}>
            <h3 style={{ marginTop: 0 }}>Agenda {servizioVista === 'pranzo' ? '☀️' : '🌙'}</h3>
            <div style={{ overflowY: 'auto', maxHeight: '350px' }}>
              {prenotazioni.filter(p => formatData(p.data_ora) === dataVista && getServizioDaOra(p.data_ora) === servizioVista).map(p => (
                <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{p.nome_cliente} ({p.numero_persone} pax)</div>
                    <div style={{ fontSize: '12px', color: '#ea4335', fontWeight: 'bold' }}>Ore {formatOra(p.data_ora)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => { setEditingId(p.id); setNomeCliente(p.nome_cliente); setNumeroPersone(p.numero_persone); setOraEsatta(formatOra(p.data_ora)); setTavoliSelezionati(p.tavoli_assegnati); }} style={{ border: 'none', background: '#f0f0f0', borderRadius: '5px', padding: '6px', cursor: 'pointer' }}>✏️</button>
                    <button onClick={async () => { if(window.confirm("Cancellare?")) { await supabase.from('prenotazioni').delete().eq('id', p.id); caricaPrenotazioni(); } }} style={{ border: 'none', background: '#fff0f0', color: 'red', borderRadius: '5px', padding: '6px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>
              ))}
              {prenotazioni.filter(p => formatData(p.data_ora) === dataVista && getServizioDaOra(p.data_ora) === servizioVista).length === 0 && <p style={{ fontSize: '13px', color: '#888' }}>Nessuna prenotazione.</p>}
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA (Mappa e Controlli) */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            {sale.map(s => (
              <button key={s.id} onClick={() => setSalaAttiva(s.id)} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: salaAttiva === s.id ? '#333' : '#fff', color: salaAttiva === s.id ? '#fff' : '#333', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>{s.nome}</button>
            ))}
            
            {/* Controlli Testo */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginLeft: 'auto', background: 'white', padding: '8px 15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>🔠 Testo:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '10px' }}>Tavolo</span>
                <input type="range" min="12" max="40" value={dimensioneTestoTavolo} onChange={e => setDimensioneTestoTavolo(Number(e.target.value))} style={{ width: '60px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '10px' }}>Cliente</span>
                <input type="range" min="7" max="20" value={dimensioneTestoCliente} onChange={e => setDimensioneTestoCliente(Number(e.target.value))} style={{ width: '60px' }} />
              </div>
            </div>

            {/* Pulsanti Sala */}
            <button onClick={salvaDisposizione} style={{ padding: '10px 15px', borderRadius: '12px', background: '#ff9800', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(255,152,0,0.3)' }}>📍 Salva Disposizione</button>
            <button onClick={async () => { await supabase.from('tavoli').insert([{ sala_id: salaAttiva, numero_tavolo: `T?`, capacita: 2, pos_x: 50, pos_y: 50 }]); caricaTavoli(); }} style={{ padding: '10px 15px', borderRadius: '12px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>➕ Tavolo</button>
          </div>

          <div style={{ height: '75vh', backgroundColor: 'white', borderRadius: '20px', position: 'relative', border: '1px solid #ddd', overflow: 'hidden', backgroundImage: 'radial-gradient(#ddd 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
            
            {/* TASTO SALVATAGGIO RAPIDO */}
            {prontoPerSalvare && (
              <button 
                onClick={salvaPrenotazione}
                style={{
                  position: 'absolute', bottom: '30px', right: '30px', zIndex: 1000,
                  backgroundColor: '#28a745', color: 'white', padding: '15px 30px',
                  fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '50px',
                  boxShadow: '0 8px 20px rgba(40, 167, 69, 0.4)', cursor: 'pointer',
                  animation: 'popIn 0.3s ease-out'
                }}
              >
                💾 SALVA PRENOTAZIONE
              </button>
            )}

            <style>
              {`@keyframes popIn { 0% { transform: scale(0); opacity: 0; } 80% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }`}
            </style>

            {/* MAPPA TAVOLI */}
            {tavoli.map(t => {
              const presTurno = getPrenotazioniTurno(t.id);
              const isSel = tavoliSelezionati.includes(t.id);
              return (
                <Draggable 
                  key={t.id} 
                  defaultPosition={{ x: t.pos_x, y: t.pos_y }} 
                  onStop={(e, d) => aggiornaPosizioneLocale(t.id, d.x, d.y)} 
                  bounds="parent"
                >
                  <div 
                    onClick={() => toggleSelezioneTavolo(t.id)}
                    style={{
                      position: 'absolute', width: '100px', minHeight: '100px', borderRadius: '12px',
                      background: isSel ? '#d1e7ff' : (presTurno.length > 0 ? '#fff5f5' : '#fff'),
                      border: `3px solid ${isSel ? '#1a73e8' : (presTurno.length > 0 ? '#ffcccc' : '#ccc')}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', padding: '15px 5px 10px 5px', transition: '0.2s'
                    }}
                  >
                    {!isSel && (
                      <div style={{ position: 'absolute', top: '-10px', left: '-10px', display: 'flex', gap: '50px' }}>
                        <button onClick={(e) => { e.stopPropagation(); modificaInfoTavolo(t); }} style={{ background: '#007bff', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>⚙️</button>
                        <button onClick={async (e) => { e.stopPropagation(); if(window.confirm("Elimina tavolo?")) { await supabase.from('tavoli').delete().eq('id', t.id); caricaTavoli(); } }} style={{ background: '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>✖</button>
                      </div>
                    )}
                    
                    <strong style={{ fontSize: `${dimensioneTestoTavolo}px`, color: '#333', textAlign: 'center', lineHeight: '1.1' }}>{t.numero_tavolo}</strong>
                    <span style={{ fontSize: '11px', color: '#888', marginBottom: '5px' }}>{t.capacita} pax</span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', alignItems: 'center' }}>
                      {presTurno.map(p => (
                        <div key={p.id} style={{ fontSize: `${dimensioneTestoCliente}px`, background: '#ea4335', color: 'white', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', width: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                          {formatOra(p.data_ora)} {p.nome_cliente}
                        </div>
                      ))}
                    </div>
                  </div>
                </Draggable>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
