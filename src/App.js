import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Draggable from 'react-draggable';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
const getServizioDaOra = (isoString) => {
  if (!isoString) return 'cena';
  return new Date(isoString).getHours() < 16 ? 'pranzo' : 'cena';
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [ricordami, setRicordami] = useState(false);
  
  // STATO PER IL RESPONSIVE DESIGN (PC vs SMARTPHONE)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  const [sale, setSale] = useState([]);
  const [salaAttiva, setSalaAttiva] = useState(null);
  const [tavoli, setTavoli] = useState([]);
  const [tuttiITavoli, setTuttiITavoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [dataVista, setDataVista] = useState(formatData(new Date().toISOString()));
  const [servizioVista, setServizioVista] = useState(new Date().getHours() < 16 ? 'pranzo' : 'cena');
  
  const [dimensioneTestoTavolo, setDimensioneTestoTavolo] = useState(20);
  const [dimensioneTestoCliente, setDimensioneTestoCliente] = useState(13);
  const [zoomMappa, setZoomMappa] = useState(0.2); 

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

  const fileInputRef = useRef(null);

  // GESTIONE LISTENER PER LA DIMENSIONE DELLO SCHERMO
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedLogin = localStorage.getItem('belvedere_logged_in');
    if (savedLogin === 'true') setIsLoggedIn(true);
    const meta = document.createElement('meta');
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.getElementsByTagName('head')[0].appendChild(meta);
  }, []);

  useEffect(() => {
    if (salaAttiva && sale.length > 0) {
      const s = sale.find(item => String(item.id) === String(salaAttiva));
      setZoomMappa(s?.zoom_std && Number(s.zoom_std) > 0 ? Number(s.zoom_std) : 0.2);
    }
  }, [salaAttiva, sale]);

  const getPrenotazioniTurno = (tavoloId) => {
    return (prenotazioni || []).filter(p => 
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

  const scaricaAgendaFile = () => {
    const presOggi = (prenotazioni || []).filter(p => formatData(p.data_ora) === dataVista && getServizioDaOra(p.data_ora) === servizioVista);
    if (presOggi.length === 0) return alert("Nessuna prenotazione da scaricare.");
    let csvContent = "ORA;CLIENTE;PAX;TAVOLI;STATO;NOTE\n";
    presOggi.forEach(p => {
      const tavoliNomi = (p.tavoli_assegnati || []).map(id => tuttiITavoli.find(t => t.id === id)?.numero_tavolo).join(", ") || "-";
      const stato = p.presente ? "ARRIVATO" : "ATTESA";
      csvContent += `${formatOra(p.data_ora)};${p.nome_cliente};${p.numero_persone};${tavoliNomi};${stato};${p.note || ""}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Agenda_${dataVista}_${servizioVista}.csv`);
    link.click();
  };

  async function esportaBackup() {
    const { data: tavoliData } = await supabase.from('tavoli').select('*');
    const { data: prenoData } = await supabase.from('prenotazioni').select('*');
    if (tavoliData || prenoData) {
      const backupObj = { tavoli: tavoliData || [], prenotazioni: prenoData || [] };
      const json = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Backup_TOTALE_Belvedere_${formatData(new Date().toISOString())}.json`;
      link.click();
    }
  }

  async function importaBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        if (!backupData.tavoli || !backupData.prenotazioni) throw new Error("File non valido");
        if (!window.confirm("⚠️ ATTENZIONE: Questo ripristinerà TAVOLI e PRENOTAZIONI esattamente come nel backup. Procedo?")) {
           e.target.value = ""; return;
        }
        
        if (backupData.tavoli.length > 0) {
          const { error } = await supabase.from('tavoli').upsert(backupData.tavoli);
          if (error) { alert("❌ ERRORE TAVOLI: " + error.message); return; }
        }
        
        if (backupData.prenotazioni.length > 0) {
          const { error } = await supabase.from('prenotazioni').upsert(backupData.prenotazioni);
          if (error) { alert("❌ ERRORE PRENOTAZIONI: " + error.message); return; }
        }
        
        alert("✅ Ripristino Totale completato!");
        aggiornaTutto();
      } catch (err) {
        alert("Errore nel ripristino. File non valido o corrotto.");
      }
      e.target.value = ""; 
    };
    reader.readAsText(file);
  }

  const aggiornaTutto = () => { caricaSale(); caricaPrenotazioni(); caricaTuttiITavoli(); };
  useEffect(() => { if (isLoggedIn) aggiornaTutto(); }, [isLoggedIn]);

  async function caricaSale() {
    let { data } = await supabase.from('sale').select('*').order('ordine');
    if (data?.length > 0) { setSale(data); if (!salaAttiva) setSalaAttiva(data[0].id); }
  }
  async function caricaPrenotazioni() {
    let { data } = await supabase.from('prenotazioni').select('*').order('data_ora', { ascending: false });
    if (data) setPrenotazioni(data);
  }
  async function caricaTuttiITavoli() {
    let { data } = await supabase.from('tavoli').select('*');
    if (data) setTuttiITavoli(data);
  }
  useEffect(() => { 
    if (salaAttiva && isLoggedIn && tuttiITavoli.length > 0) {
      setTavoli(tuttiITavoli.filter(t => String(t.sala_id) === String(salaAttiva)));
    }
  }, [salaAttiva, tuttiITavoli, isLoggedIn]);

  async function salvaPrenotazione(e) {
    if (e) e.preventDefault();
    if (tavoliSelezionati.length === 0) return alert("Seleziona almeno un tavolo!");
    const payload = { 
      nome_cliente: nomeCliente, 
      numero_persone: parseInt(numeroPersone), 
      data_ora: new Date(`${dataVista}T${oraEsatta}`).toISOString(), 
      tavoli_assegnati: tavoliSelezionati, 
      note,
      presente: editingId ? prenotazioni.find(x => x.id === editingId)?.presente : false
    };
    const { error } = editingId ? await supabase.from('prenotazioni').update(payload).eq('id', editingId) : await supabase.from('prenotazioni').insert([payload]);
    if (!error) { resetForm(); aggiornaTutto(); setTimeout(scaricaAgendaFile, 1000); }
  }

  async function occupaTavoloVeloce(tavoloId) {
    const t = tuttiITavoli.find(x => x.id === tavoloId);
    const pax = window.prompt("Quante persone?", t?.capacita || "2");
    if (!pax) return;

    const now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');

    if (servizioVista === 'pranzo' && now.getHours() >= 16) { hh = '13'; mm = '00'; }
    if (servizioVista === 'cena' && now.getHours() < 16) { hh = '20'; mm = '00'; }

    const payload = {
      nome_cliente: 'Senza Prenotazione',
      numero_persone: parseInt(pax),
      data_ora: new Date(`${dataVista}T${hh}:${mm}`).toISOString(),
      tavoli_assegnati: [tavoloId],
      note: '',
      presente: true 
    };

    const { error } = await supabase.from('prenotazioni').insert([payload]);
    if (!error) {
      aggiornaTutto();
      setTavoloInfo(null);
    } else {
      alert("Errore nell'occupare il tavolo!");
    }
  }

  async function spostaTavoloRapido(prenoId, nuovoTavoloId) {
    if (!nuovoTavoloId) return;
    const targetTable = tuttiITavoli.find(t => String(t.id) === String(nuovoTavoloId));
    if (!targetTable) return alert("Errore: Tavolo non trovato!");

    const { error } = await supabase.from('prenotazioni').update({ tavoli_assegnati: [targetTable.id] }).eq('id', prenoId);
    if (!error) {
      setPrenoInSpostamento(null);
      setTavoloInfo(null);
      aggiornaTutto();
    } else {
      alert("Errore nello spostamento.");
    }
  }

  async function togglePresenza(id, statoAttuale) {
    const { error } = await supabase.from('prenotazioni').update({ presente: !statoAttuale }).eq('id', id);
    if (!error) aggiornaTutto();
  }

  async function aggiungiTavolo() {
    await supabase.from('tavoli').insert([{ sala_id: salaAttiva, numero_tavolo: '?', capacita: 2, pos_x: 100, pos_y: 100, std_x: 100, std_y: 100 }]);
    await caricaTuttiITavoli(); 
    esportaBackup(); 
  }

  async function eliminaTavolo(id) {
    if (window.confirm("Eliminare definitivamente il tavolo?")) { await supabase.from('tavoli').delete().eq('id', id); aggiornaTutto(); }
  }

  async function salvaCorrente() {
    const promises = tavoli.map(t => supabase.from('tavoli').update({ pos_x: Number(t.pos_x) || 0, pos_y: Number(t.pos_y) || 0 }).eq('id', t.id));
    await Promise.all(promises);
    setIsEditMode(false);
    await caricaTuttiITavoli();
    esportaBackup(); 
    alert("📍 Posizioni salvate! Backup generato.");
  }

  async function salvaZoomReparto() {
    const { error } = await supabase.from('sale').update({ zoom_std: zoomMappa }).eq('id', salaAttiva);
    if (!error) alert("🔍 Zoom salvato!");
  }

  async function impostaStandard() {
    if (!window.confirm("Impostare la situazione attuale come STANDARD?")) return;
    const promises = tavoli.map(t => supabase.from('tavoli').update({ std_x: Number(t.pos_x) || 0, std_y: Number(t.pos_y) || 0 }).eq('id', t.id));
    await Promise.all(promises);
    alert("⭐ Standard salvato!");
    aggiornaTutto();
  }

  async function ripristinaStandard() {
    if (!window.confirm("Tornare alla disposizione STANDARD?")) return;
    const promises = tavoli.map(t => {
       const targetX = t.std_x !== null ? t.std_x : t.pos_x;
       const targetY = t.std_y !== null ? t.std_y : t.pos_y;
       return supabase.from('tavoli').update({ pos_x: Number(targetX) || 0, pos_y: Number(targetY) || 0 }).eq('id', t.id);
    });
    await Promise.all(promises);
    alert("🔄 Sala ripristinata!");
    aggiornaTutto();
  }

  const handleLogin = (e) => {
    e.preventDefault();
    if (passInput === "Seba") { setIsLoggedIn(true); if (ricordami) localStorage.setItem('belvedere_logged_in', 'true'); }
    else alert("Password errata!");
  };

  const resetForm = () => { setEditingId(null); setNomeCliente(''); setNumeroPersone(''); setOraEsatta(''); setNote(''); setTavoliSelezionati([]); };

  // ==========================================
  // FUNZIONI ASSISTENTE VOCALE AVANZATO
  // ==========================================
  const ascoltaComando = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Il tuo browser o dispositivo non supporta il riconoscimento vocale. Usa Chrome o Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTestoVocale('Ascolto... (es: "Domenica 11 ore 12:30 tavolo 1 per Rossi 5 persone")');
    };
    
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setTestoVocale(`Hai detto: "${transcript}"`);
      compilaFormDaVoce(transcript);
    };

    recognition.start();
  };

  const compilaFormDaVoce = (fraseOriginale) => {
    let frase = fraseOriginale.toLowerCase().replace(/\bmezza\b/g, '30');

    const numeriTestuali = {
      'uno': '1', 'un': '1', 'una': '1', 'due': '2', 'tre': '3', 'quattro': '4', 
      'cinque': '5', 'sei': '6', 'sette': '7', 'otto': '8', 'nove': '9', 'dieci': '10',
      'undici': '11', 'dodici': '12', 'tredici': '13', 'quattordici': '14', 'quindici': '15',
      'sedici': '16', 'diciassette': '17', 'diciotto': '18', 'diciannove': '19', 'venti': '20'
    };
    Object.keys(numeriTestuali).forEach(parola => {
       const regex = new RegExp(`\\b${parola}\\b`, 'gi');
       frase = frase.replace(regex, numeriTestuali[parola]);
    });

    let fraseSenzaDati = frase;

    // 2. Estrai Persone
    let pax = '';
    const matchPersone = fraseSenzaDati.match(/(\d+)\s*person/i);
    if (matchPersone) {
      pax = matchPersone[1];
      fraseSenzaDati = fraseSenzaDati.replace(matchPersone[0], '');
    }

    // 3. Estrai Ora e imposta Pranzo/Cena
    let ora = '';
    const matchOra = fraseSenzaDati.match(/(?:ore|alle|le)\s*(\d{1,2})(?:[\:\s\.]*(?:e\s*)?(\d{2}))?/i);
    if (matchOra) {
      let hh = parseInt(matchOra[1], 10);
      let computedServizio = hh < 16 ? 'pranzo' : 'cena';
      
      if (computedServizio === 'pranzo' && hh >= 7 && hh <= 11 && fraseSenzaDati.includes('cena')) {
          hh += 12; 
          computedServizio = 'cena';
      } else if (hh >= 7 && hh <= 11 && computedServizio === 'pranzo') {
          hh += 12;
          computedServizio = 'cena';
      }

      setServizioVista(computedServizio);
      
      const hhStr = String(hh).padStart(2, '0');
      const mmStr = matchOra[2] ? matchOra[2].padStart(2, '0') : '00';
      ora = `${hhStr}:${mmStr}`;
      fraseSenzaDati = fraseSenzaDati.replace(matchOra[0], '');
    }

    // 4. Estrai Data
    let dateToSet = formatData(new Date().toISOString()); 
    let baseDate = new Date();

    let m1 = fraseSenzaDati.match(/(?:(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|giorno)\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i);
    let m2 = !m1 ? fraseSenzaDati.match(/(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|giorno)\s+(\d{1,2})\b/i) : null;

    if (/\bdomani\b/i.test(fraseSenzaDati)) {
        baseDate.setDate(baseDate.getDate() + 1);
        dateToSet = formatData(baseDate.toISOString());
        fraseSenzaDati = fraseSenzaDati.replace(/\bdomani\b/i, '');
    } else if (/\boggi\b/i.test(fraseSenzaDati)) {
        dateToSet = formatData(baseDate.toISOString());
        fraseSenzaDati = fraseSenzaDati.replace(/\boggi\b/i, '');
    } else if (m1 || m2) {
        let dayMatch = m1 ? parseInt(m1[1], 10) : parseInt(m2[2], 10);
        let monthMatchStr = m1 ? m1[2].toLowerCase() : null;
        let matchStrToRemove = m1 ? m1[0] : m2[0];
        
        let monthMatch = baseDate.getMonth();
        if (monthMatchStr) {
            const mesi = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
            monthMatch = mesi.indexOf(monthMatchStr);
        }
        let targetDate = new Date(baseDate.getFullYear(), monthMatch, dayMatch);
        let todayNoTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
        
        if (targetDate < todayNoTime) {
            if (monthMatchStr) targetDate.setFullYear(targetDate.getFullYear() + 1);
            else targetDate.setMonth(targetDate.getMonth() + 1);
        }
        dateToSet = formatData(targetDate.toISOString());
        fraseSenzaDati = fraseSenzaDati.replace(matchStrToRemove, '');
    }
    setDataVista(dateToSet); 

    // 5. Estrai Tavolo
    let foundTableIds = [];
    const matchTavolo = fraseSenzaDati.match(/tavolo\s*([\d\.]+)/i);
    if (matchTavolo) {
       const targetTable = tuttiITavoli.find(t => String(t.numero_tavolo) === String(matchTavolo[1]));
       if (targetTable) foundTableIds.push(targetTable.id);
       fraseSenzaDati = fraseSenzaDati.replace(matchTavolo[0], '');
    }
    setTavoliSelezionati(foundTableIds);

    // 6. Nome
    let nomePulito = fraseSenzaDati
      .replace(/\baggiungi\b|\binserisci\b|\bnuova\b|\bprenota\b|\bprenotazione\b|\bal\b|\bil\b|\bper\b/gi, '')
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const nomeFinale = nomePulito.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');

    if (nomeFinale) setNomeCliente(nomeFinale);
    else setNomeCliente('');
    if (pax) setNumeroPersone(pax);
    
    const orariDisponibili = generaOrari();
    if (ora && orariDisponibili.includes(ora)) setOraEsatta(ora);
    else if (ora) setOraEsatta(ora); 

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prenotazioniDelServizio = (prenotazioni || []).filter(p => formatData(p.data_ora) === dataVista && getServizioDaOra(p.data_ora) === servizioVista);
  const totalePaxServizio = prenotazioniDelServizio.reduce((acc, p) => acc + (p.numero_persone || 0), 0);
  const risultatiRicerca = ricerca.length > 1 ? (prenotazioni || []).filter(p => p.nome_cliente && p.nome_cliente.toLowerCase().includes(ricerca.toLowerCase())) : [];

  const clickTavoloSfondo = (id) => {
    if (isEditMode) return;
    if (oraEsatta) setTavoliSelezionati(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    else setTavoloInfo(id);
  };

  const aggiornaPosizioneLocale = (id, x, y) => {
    setTavoli(prev => prev.map(t => t.id === id ? { ...t, pos_x: Math.round(x), pos_y: Math.round(y) } : t));
  };

  async function modificaInfoTavolo(t) {
    if (!t) return;
    const n = window.prompt("Nome tavolo:", t.numero_tavolo);
    if (n === null) return;
    const p = window.prompt("Capacità posti:", t.capacita);
    if (p === null) return;
    if (n && p) { await supabase.from('tavoli').update({ numero_tavolo: n, capacita: parseInt(p) }).eq('id', t.id); aggiornaTutto(); }
  }

  const tavoliOrdinati = [...(tuttiITavoli || [])].sort((a, b) => {
    const numA = parseInt(a.numero_tavolo) || 999;
    const numB = parseInt(b.numero_tavolo) || 999;
    return numA - numB;
  });

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f6f8' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '85%', maxWidth: '350px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <h2 style={{ textAlign: 'center', color: '#1a73e8', marginBottom: '25px' }}>Belvedere 🍷</h2>
          <input type="password" placeholder="Password" value={passInput} onChange={e => setPassInput(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
          <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="ric" checked={ricordami} onChange={e => setRicordami(e.target.checked)} style={{ width: '20px', height: '20px' }} /> <label htmlFor="ric">Ricordami</label>
          </div>
          <button type="submit" style={{ width: '100%', padding: '15px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', marginTop: '20px' }}>ACCEDI</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f4f6f8', minHeight: '100vh', padding: '10px', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
      
      <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={importaBackup} />

      {/* HEADER GLOBALE */}
      <div style={{ background: 'white', padding: '15px', borderRadius: '16px', marginBottom: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <b style={{ fontSize: '20px' }}>Belvedere 🍷</b>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
             
             <button onClick={() => setShowDisponibilita(true)} style={{ background: '#17a2b8', color: 'white', padding: '8px 16px', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 2px 5px rgba(23,162,184,0.3)' }}>
                📊 Disponibilità
             </button>

             <button onClick={ascoltaComando} style={{ background: isListening ? '#dc3545' : '#6f42c1', color: 'white', padding: '8px 16px', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '13px', boxShadow: isListening ? '0 0 10px #dc3545' : 'none' }}>
                {isListening ? '🎙️ In ascolto...' : '🎤 Compila a Voce'}
             </button>

             <button onClick={scaricaAgendaFile} style={{ background: '#e7f1ff', color: '#0d6efd', padding: '8px 12px', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '12px' }}>📥 AGENDA</button>
             <button onClick={aggiornaTutto} style={{ background: '#e6f4ea', color: '#28a745', padding: '8px 12px', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '12px' }}>🔄 Aggiorna</button>
             <button onClick={() => { setIsLoggedIn(false); localStorage.removeItem('belvedere_logged_in'); }} style={{ background: '#f8f9fa', color: '#dc3545', padding: '8px 12px', borderRadius: '10px', border: '1px solid #ddd', fontWeight: 'bold', fontSize: '12px' }}>Esci</button>
          </div>
        </div>
        
        {testoVocale && (
          <div style={{ padding: '10px', backgroundColor: '#f3f0ff', color: '#6f42c1', borderRadius: '8px', marginBottom: '10px', fontSize: '14px', fontStyle: 'italic' }}>
            🗣️ {testoVocale}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', alignItems: 'center' }}>
          <input type="date" value={dataVista} onChange={e => setDataVista(e.target.value)} style={{ padding: '10px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '14px' }} />
          <div style={{ background: '#f1f3f5', borderRadius: '12px', padding: '4px', display: 'flex', gap: '4px' }}>
            <button onClick={() => setServizioVista('pranzo')} style={{ padding: '8px 16px', border: 'none', borderRadius: '10px', background: servizioVista === 'pranzo' ? 'white' : 'transparent', color: servizioVista === 'pranzo' ? '#1a73e8' : '#555', fontSize: '14px', fontWeight: 'bold', boxShadow: servizioVista === 'pranzo' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none' }}>PRANZO</button>
            <button onClick={() => setServizioVista('cena')} style={{ padding: '8px 16px', border: 'none', borderRadius: '10px', background: servizioVista === 'cena' ? 'white' : 'transparent', color: servizioVista === 'cena' ? '#1a73e8' : '#555', fontSize: '14px', fontWeight: 'bold', boxShadow: servizioVista === 'cena' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none' }}>CENA</button>
          </div>
        </div>
      </div>

      {/* STRUTTURA RESPONSIVE: PC (2 Colonne) vs MOBILE (1 Colonna) */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
        
        {/* COLONNA SINISTRA: Form + Agenda */}
        <div style={{ flex: isMobile ? '1' : '0 0 32%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* FORM PRENOTAZIONE */}
          <div style={{ background: 'white', padding: '18px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <form onSubmit={salvaPrenotazione} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Nome Cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} required style={{ padding: '14px', borderRadius: '12px', border: '1px solid #ced4da', fontSize: '16px' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="number" placeholder="Pax" value={numeroPersone} onChange={e => setNumeroPersone(e.target.value)} required style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #ced4da', fontSize: '16px' }} />
                <select value={oraEsatta} onChange={e => setOraEsatta(e.target.value)} required style={{ flex: 1.5, padding: '14px', borderRadius: '12px', border: '1px solid #ced4da', fontSize: '16px', fontWeight: 'bold' }}>
                  <option value="">Ora...</option>
                  {generaOrari().map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <textarea placeholder="Note o cellulare..." value={note} onChange={e => setNote(e.target.value)} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #ced4da', minHeight: '60px', fontSize: '15px' }} />
              
              <select value="" onChange={(e) => { 
                  const val = e.target.value; 
                  const targetTable = tuttiITavoli.find(t => String(t.id) === String(val));
                  if (targetTable && !tavoliSelezionati.includes(targetTable.id)) {
                      setTavoliSelezionati(prev => [...prev, targetTable.id]);
                  }
              }} style={{ padding: '14px', borderRadius: '12px', border: '2px solid #e7f1ff', fontSize: '16px', fontWeight: 'bold' }}>
                <option value="">➕ Assegna Tavolo Rapido...</option>
                {(tavoli || []).map(t => <option key={t.id} value={t.id}>{t.numero_tavolo} - {getPrenotazioniTurno(t.id).length === 0 ? "🟢 Libero" : "🟠 Occupato"}</option>)}
              </select>
              {tavoliSelezionati.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tavoliSelezionati.map(id => (
                      <div key={id} onClick={() => setTavoliSelezionati(prev => prev.filter(x => x !== id))} style={{ background: '#0d6efd', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {(tuttiITavoli || []).find(x => x.id === id)?.numero_tavolo} ✖
                      </div>
                    ))}
                  </div>
              )}
              {/* Tasto Salva integrato nel form */}
              <button type="submit" style={{ padding: '16px', background: '#1a73e8', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>💾 SALVA PRENOTAZIONE</button>
            </form>
          </div>

          {/* AGENDA E RICERCA */}
          <div style={{ background: 'white', padding: '18px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <input type="text" placeholder="🔍 Ricerca archivio clienti..." value={ricerca} onChange={e => setRicerca(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ced4da', fontSize: '15px', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />
            
            {ricerca.length > 1 ? (
              <div>
                <h3 style={{ fontSize: '16px', color: '#1a73e8' }}>Risultati Archivio:</h3>
                {risultatiRicerca.map(p => (
                  <div key={p.id} style={{ padding: '12px', borderBottom: '1px solid #eee', background: p.presente ? '#e6f4ea' : '#f8f9fa', borderRadius: '10px', marginBottom: '10px' }}>
                    <b style={{color: p.presente ? '#28a745' : '#333'}}>{formatDataLeggibile(p.data_ora)}</b> - <b style={{color: p.presente ? '#28a745' : '#333'}}>{p.nome_cliente}</b> ({p.numero_persone}p)
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      <button onClick={() => togglePresenza(p.id, p.presente)} style={{ flex: 1, border: p.presente ? '2px solid #28a745' : '1px solid #ddd', background: p.presente ? '#28a745' : '#fff', color: p.presente ? 'white' : '#666', padding: '8px', borderRadius: '8px', fontWeight: 'bold' }}>{p.presente ? '✅ ARRIVATO' : 'ATTESA'}</button>
                      <button onClick={() => { setEditingId(p.id); setNomeCliente(p.nome_cliente); setNumeroPersone(p.numero_persone); setDataVista(formatData(p.data_ora)); setServizioVista(getServizioDaOra(p.data_ora)); setOraEsatta(formatOra(p.data_ora)); setNote(p.note || ''); setTavoliSelezionati(p.tavoli_assegnati || []); setRicerca(''); window.scrollTo(0,0); }} style={{ flex: 1, border: 'none', background: '#1a73e8', color: 'white', padding: '8px', borderRadius: '8px', fontWeight: 'bold' }}>✏️ MOD</button>
                      <button onClick={async () => { if(window.confirm("Eliminare?")) { await supabase.from('prenotazioni').delete().eq('id', p.id); aggiornaTutto(); } }} style={{ border: 'none', background: '#fff0f0', color: '#dc3545', padding: '8px', borderRadius: '8px', fontWeight: 'bold' }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Agenda {servizioVista} <span style={{ color: '#1a73e8' }}>({totalePaxServizio} pax)</span></h3>
                {(sale || []).map(reparto => {
                  const presRep = prenotazioniDelServizio.filter(p => p.tavoli_assegnati && p.tavoli_assegnati.some(tid => (tuttiITavoli || []).find(x => x.id === tid)?.sala_id === reparto.id));
                  if (presRep.length === 0) return null;
                  return (
                    <div key={reparto.id} style={{ marginTop: '15px' }}>
                      <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '8px', borderLeft: '4px solid #1a73e8', display: 'flex', justifyContent: 'space-between' }}>
                        <b style={{textTransform: 'uppercase'}}>{reparto.nome}</b> <b>{presRep.reduce((a,b) => a + b.numero_persone, 0)} pax</b>
                      </div>
                      {presRep.map(p => (
                        <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f3f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: p.presente ? '#f0fdf4' : 'transparent', borderRadius: '8px' }}>
                          <div style={{flex: 1, paddingLeft: '5px'}}>
                            <b style={{color: p.presente ? '#28a745' : '#333'}}>{formatOra(p.data_ora)}</b> - <span style={{color: p.presente ? '#28a745' : '#333', fontWeight: p.presente ? 'bold' : 'normal'}}>{p.nome_cliente} ({p.numero_persone}p)</span>
                            <div style={{fontSize: '12px', color: '#666'}}>Tav: {(p.tavoli_assegnati || []).map(id => (tuttiITavoli || []).find(x => x.id === id)?.numero_tavolo).join(", ")}</div>
                          </div>
                          <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end', width: '50%'}}>
                            <button onClick={() => togglePresenza(p.id, p.presente)} style={{ border: 'none', background: p.presente ? '#28a745' : '#e9ecef', color: p.presente ? 'white' : '#666', padding: '8px', borderRadius: '8px', fontWeight: 'bold' }}>{p.presente ? '✅' : '⏳'}</button>
                            <button onClick={() => { setEditingId(p.id); setNomeCliente(p.nome_cliente); setNumeroPersone(p.numero_persone); setOraEsatta(formatOra(p.data_ora)); setNote(p.note || ''); setTavoliSelezionati(p.tavoli_assegnati || []); window.scrollTo(0,0); }} style={{ border: 'none', background: '#e7f1ff', padding: '8px', borderRadius: '8px', fontSize: '16px' }}>✏️</button>
                            <button onClick={async () => { if(window.confirm("Eliminare?")) { await supabase.from('prenotazioni').delete().eq('id', p.id); aggiornaTutto(); } }} style={{ border: 'none', background: '#fff0f0', padding: '8px', borderRadius: '8px', fontSize: '16px' }}>🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLONNA DESTRA: Controlli Mappa e Mappa (Sticky su PC) */}
        <div style={{ flex: isMobile ? '1' : '0 0 65%', display: 'flex', flexDirection: 'column', gap: '15px', position: isMobile ? 'static' : 'sticky', top: '15px', paddingBottom: isMobile ? '100px' : '0' }}>
          
          {/* BARRA ZOOM E SELEZIONE SALA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px 18px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
              <button onClick={() => setIsEditMode(!isEditMode)} style={{ padding: '10px 15px', borderRadius: '12px', border: 'none', background: isEditMode ? '#28a745' : '#dc3545', color: 'white', fontSize: '18px', cursor: 'pointer' }}>{isEditMode ? "🔓" : "🔒"}</button>
              <select value={salaAttiva || ''} onChange={e => setSalaAttiva(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #ced4da', fontSize: '16px', fontWeight: 'bold' }}>
                {(sale || []).map(s => <option key={s.id} value={s.id}>{s.nome.toUpperCase()}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '200px' }}>
              <b style={{fontSize: '14px', color: '#666'}}>🔍 ZOOM:</b> 
              <input type="range" min="0.2" max="1.2" step="0.1" value={zoomMappa} onChange={e => setZoomMappa(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>

          {/* TASTI MODIFICA MAPPA & BACKUP */}
          {isEditMode && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '5px' }}>
                <button onClick={aggiungiTavolo} style={{ background: '#0d6efd', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>➕ Tavolo</button>
                <button onClick={salvaCorrente} style={{ background: '#28a745', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>📍 Salva Pos.</button>
                <button onClick={salvaZoomReparto} style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>🔍 Salva Zoom</button>
                <button onClick={impostaStandard} style={{ background: '#f3e8ff', color: '#6f42c1', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>⭐ Set Std</button>
                <button onClick={ripristinaStandard} style={{ background: '#fff8e1', color: '#d39e00', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>🔄 Reset Std</button>
                <button onClick={esportaBackup} style={{ background: '#343a40', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>💾 Backup</button>
                <button onClick={() => { if(fileInputRef.current) fileInputRef.current.click() }} style={{ background: '#e83e8c', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>📂 Ripristina</button>
            </div>
          )}

          {/* MAPPA INTERATTIVA INGRANDITA (con Scroll per Mobile) */}
          <div style={{ width: '100%', height: isMobile ? '55vh' : '75vh', backgroundColor: '#e9ecef', borderRadius: '16px', border: '2px solid #dee2e6', overflow: 'auto', position: 'relative' }}>
            <div style={{ width: '1300px', height: '1300px', position: 'relative', transform: `scale(${parseFloat(zoomMappa) || 0.2})`, transformOrigin: 'top left' }}>
              {(tavoli || []).map(t => {
                const pres = getPrenotazioniTurno(t.id);
                const sel = tavoliSelezionati.includes(t.id);
                
                let bgCol = 'white';
                let bCol = '#adb5bd';
                if (sel) { bgCol = '#cfe2ff'; bCol = '#0d6efd'; } // Selezionato (Azzurro)
                else if (pres.length > 1) { bgCol = '#dc3545'; bCol = '#a71d2a'; } // Doppio Turno (ROSSO)
                else if (pres.some(p => p.presente)) { bgCol = '#d1e7dd'; bCol = '#28a745'; } // Presente (Verde)
                else if (pres.length === 1) { bgCol = '#fd7e14'; bCol = '#d35400'; } // Occupato (Arancione)

                return (
                  <Draggable key={t.id} disabled={!isEditMode} scale={parseFloat(zoomMappa) || 0.2} position={{ x: Number(t.pos_x) || 0, y: Number(t.pos_y) || 0 }} onStop={(e, d) => aggiornaPosizioneLocale(t.id, d.x, d.y)} bounds="parent">
                    <div onClick={() => clickTavoloSfondo(t.id)}
                         style={{ position: 'absolute', width: '145px', height: '145px', borderRadius: '18px', background: bgCol, border: `3px solid ${bCol}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: isEditMode ? 'move' : 'pointer', touchAction: 'none' }}>
                      
                      {isEditMode && (
                        <>
                          <button 
                            onMouseDown={(e) => { e.stopPropagation(); }} 
                            onTouchStart={(e) => { e.stopPropagation(); }} 
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); modificaInfoTavolo(t); }} 
                            style={{ position: 'absolute', top: '-18px', left: '-18px', zIndex: 9999, background: '#f8f9fa', color: '#0d6efd', border: '2px solid #0d6efd', borderRadius: '50%', width: '45px', height: '45px', fontSize: '22px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ⚙️
                          </button>
                          
                          <button 
                            onMouseDown={(e) => { e.stopPropagation(); }} 
                            onTouchStart={(e) => { e.stopPropagation(); }} 
                            onClick={async (e) => { e.stopPropagation(); e.preventDefault(); if(window.confirm("Eliminare definitivamente il tavolo?")) { await supabase.from('tavoli').delete().eq('id', t.id); aggiornaTutto(); } }} 
                            style={{ position: 'absolute', top: '-18px', right: '-18px', zIndex: 9999, background: '#dc3545', color: 'white', border: '2px solid white', borderRadius: '50%', width: '45px', height: '45px', fontSize: '20px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✖
                          </button>
                        </>
                      )}

                      <strong style={{ fontSize: `${dimensioneTestoTavolo}px`, marginBottom: '4px', color: (bgCol === '#dc3545') ? 'white' : '#333' }}>{t.numero_tavolo}</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '95%' }}>
                        {pres.map(p => (
                          <div key={p.id} onClick={(e) => { e.stopPropagation(); setTavoloInfo(t.id); }} style={{ fontSize: `${dimensioneTestoCliente}px`, background: p.presente ? '#28a745' : 'rgba(0,0,0,0.75)', color: 'white', padding: '4px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', wordBreak: 'break-word', whiteSpace: 'normal', border: p.presente ? '2px solid white' : 'none', lineHeight: '1.2' }}>
                            {formatOra(p.data_ora)} - {p.nome_cliente} <br/> ({p.numero_persone}p)
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

      {/* POP-UP TAVOLO MULTIPLO MAPPA */}
      {tavoloInfo && (() => {
        const presSulTavolo = getPrenotazioniTurno(tavoloInfo);
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => { setTavoloInfo(null); setPrenoInSpostamento(null); }}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <h2 style={{ marginTop: 0, fontSize: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Tavolo {(tuttiITavoli || []).find(x => x.id === tavoloInfo)?.numero_tavolo}</h2>
              
              {presSulTavolo.length > 0 && (
                <div style={{ margin: '15px 0' }}>
                  {presSulTavolo.map(p => (
                    <div key={p.id} style={{ background: p.presente ? '#e6f4ea' : '#f8f9fa', padding: '12px', borderRadius: '12px', marginBottom: '10px', border: '1px solid #eee' }}>
                      <b style={{color: p.presente ? '#28a745' : '#333'}}>{formatOra(p.data_ora)}</b> - <span style={{color: p.presente ? '#28a745' : '#333', fontWeight: p.presente ? 'bold' : 'normal'}}>{p.nome_cliente} ({p.numero_persone}p)</span>
                      
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                        <button onClick={() => togglePresenza(p.id, p.presente)} style={{ flex: 1, background: p.presente ? '#28a745' : '#fff', color: p.presente ? 'white' : '#666', padding: '8px', borderRadius: '8px', fontWeight: 'bold', border: '1px solid #ddd', cursor: 'pointer' }}>{p.presente ? '✅' : 'ATTESA'}</button>
                        
                        {prenoInSpostamento === p.id ? (
                          <select onChange={(e) => spostaTavoloRapido(p.id, e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid #fd7e14' }}>
                            <option value="">A Tavolo...</option>
                            {tavoliOrdinati.map(tav => <option key={tav.id} value={tav.id}>Tav. {tav.numero_tavolo}</option>)}
                          </select>
                        ) : (
                          <button onClick={() => setPrenoInSpostamento(p.id)} style={{ flex: 1, background: '#fd7e14', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 SPOSTA</button>
                        )}
                        
                        <button onClick={() => { setEditingId(p.id); setNomeCliente(p.nome_cliente); setNumeroPersone(p.numero_persone); setOraEsatta(formatOra(p.data_ora)); setNote(p.note || ''); setTavoliSelezionati(p.tavoli_assegnati || []); setTavoloInfo(null); window.scrollTo(0,0); }} style={{ flex: 0.5, padding: '8px', borderRadius: '8px', border: 'none', background: '#1a73e8', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>✏️</button>
                        <button onClick={async () => { if(window.confirm("Eliminare?")) { await supabase.from('prenotazioni').delete().eq('id', p.id); aggiornaTutto(); setTavoloInfo(null); } }} style={{ flex: 0.5, padding: '8px', borderRadius: '8px', border: 'none', background: '#dc3545', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => occupaTavoloVeloce(tavoloInfo)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#28a745', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>🚶 OCCUPA (Senza Pren.)</button>
                <button onClick={() => { setTavoliSelezionati([tavoloInfo]); setTavoloInfo(null); window.scrollTo(0,0); }} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #1a73e8', background: 'white', color: '#1a73e8', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>➕ NUOVA PRENOTAZIONE</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POP-UP DISPONIBILITÀ GLOBALE */}
      {showDisponibilita && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 4000, overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }} onClick={() => setShowDisponibilita(false)}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '20px', maxWidth: '900px', margin: '0 auto', minHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
               <h2 style={{ margin: 0, color: '#1a73e8' }}>📊 Disponibilità</h2>
               
               <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="date" value={dataVista} onChange={e => setDataVista(e.target.value)} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '14px' }} />
                  <div style={{ background: '#f1f3f5', borderRadius: '10px', padding: '4px', display: 'flex', gap: '4px' }}>
                    <button onClick={() => setServizioVista('pranzo')} style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', background: servizioVista === 'pranzo' ? 'white' : 'transparent', color: servizioVista === 'pranzo' ? '#1a73e8' : '#555', fontSize: '13px', fontWeight: 'bold', boxShadow: servizioVista === 'pranzo' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}>PRANZO</button>
                    <button onClick={() => setServizioVista('cena')} style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', background: servizioVista === 'cena' ? 'white' : 'transparent', color: servizioVista === 'cena' ? '#1a73e8' : '#555', fontSize: '13px', fontWeight: 'bold', boxShadow: servizioVista === 'cena' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}>CENA</button>
                  </div>
               </div>

               <button onClick={() => setShowDisponibilita(false)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>CHIUDI ✖</button>
            </div>
            
            {(sale || []).map(s => {
               const tavoliSala = (tuttiITavoli || []).filter(t => t.sala_id === s.id).sort((a,b) => parseInt(a.numero_tavolo) - parseInt(b.numero_tavolo));
               if (tavoliSala.length === 0) return null;
               
               return (
                 <div key={s.id} style={{ marginBottom: '35px' }}>
                   <h3 style={{ background: '#f8f9fa', padding: '12px', borderRadius: '12px', borderLeft: '5px solid #1a73e8', marginTop: 0 }}>{s.nome.toUpperCase()}</h3>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                     {tavoliSala.map(t => {
                       const pres = getPrenotazioniTurno(t.id);
                       const isFree = pres.length === 0;
                       const isDouble = pres.length > 1;
                       
                       let bgC = '#f0fdf4';
                       let borderC = '#28a745';
                       if (isDouble) { bgC = '#f8d7da'; borderC = '#dc3545'; } // ROSSO
                       else if (!isFree) { bgC = '#fff8e1'; borderC = '#fd7e14'; } // ARANCIONE

                       return (
                         <div key={t.id} style={{ width: '130px', padding: '15px 10px', borderRadius: '12px', border: `2px solid ${borderC}`, background: bgC, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                           <strong style={{ fontSize: '18px', color: isDouble ? '#dc3545' : '#333' }}>Tav. {t.numero_tavolo}</strong>
                           <div style={{ fontSize: '13px', marginTop: '8px' }}>
                             {isFree ? (
                               <span style={{ color: '#28a745', fontWeight: 'bold', display: 'block', padding: '5px 0' }}>🟢 LIBERO</span>
                             ) : (
                               pres.map(p => (
                                 <div key={p.id} style={{ color: isDouble ? 'white' : '#d35400', fontWeight: 'bold', background: isDouble ? '#dc3545' : '#ffe8cc', padding: '5px', borderRadius: '6px', marginBottom: '4px', lineHeight: '1.2' }}>
                                   {formatOra(p.data_ora)}<br/>{p.nome_cliente}<br/>({p.numero_persone}p)
                                 </div>
                               ))
                             )}
                           </div>
                         </div>
                       )
                     })}
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      )}

      {/* PULSANTONE FLUTTUANTE SOLO SU MOBILE */}
      {isMobile && nomeCliente && oraEsatta && tavoliSelezionati.length > 0 && !isEditMode && (
        <button onClick={salvaPrenotazione} style={{ position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: '#28a745', color: 'white', padding: '18px 0', borderRadius: '50px', border: 'none', fontWeight: 'bold', fontSize: '18px', width: '90%', boxShadow: '0 8px 25px rgba(40, 167, 69, 0.4)' }}>💾 CONFERMA PRENOTAZIONE</button>
      )}
    </div>
  );
}
