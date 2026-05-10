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

  const fileInputRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [mapScale, setMapScale] = useState(1);
  const VIRTUAL_WIDTH = 1500; 
  const VIRTUAL_HEIGHT = 1000; 
  
  const isAdmin = userRole === 'admin';
  const dimensioneTestoTavolo = 18;

  const isEditModeRef = useRef(isEditMode);
  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  const prenotazioniAttive = prenotazioni.filter(p => !p.eliminata);
  const prenotazioniEliminate = prenotazioni.filter(p => p.eliminata).sort((a,b) => new Date(b.data_eliminazione) - new Date(a.data_eliminazione));

  const updateMapScale = () => {
    const savedZoom = localStorage.getItem('belvedere_map_zoom');
    if (savedZoom) {
      setMapScale(parseFloat(savedZoom));
    } else if (mapContainerRef.current) {
      const { clientWidth } = mapContainerRef.current;
      const initialScale = isMobile ? Math.min(clientWidth / 800, 1) : Math.min(clientWidth / VIRTUAL_WIDTH, 1);
      setMapScale(initialScale); 
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992);
    };
    window.addEventListener('resize', handleResize);
    setTimeout(updateMapScale, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLoggedIn, isFullscreen]);

  useEffect(() => {
    const savedLogin = localStorage.getItem('belvedere_logged_in');
    const savedRole = localStorage.getItem('belvedere_user_role');
    if (savedLogin === 'true' && savedRole) {
      setIsLoggedIn(true);
      setUserRole(savedRole);
    }
  }, []);

  const topBtnStyle = { 
    padding: '10px 16px', 
    borderRadius: '10px', 
    border: 'none', 
    fontWeight: 'bold', 
    fontSize: '13px', 
    cursor: 'pointer',
    whiteSpace: 'nowrap', 
    flexShrink: 0 
  };

  const mapBtnStyle = { 
    padding: '10px 14px', 
    borderRadius: '12px', 
    border: 'none', 
    color: 'white', 
    fontSize: '13px', 
    fontWeight: 'bold', 
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  };

  const zoomBtnSize = '40px';
  const zoomIn = () => setMapScale(prev => Math.min(prev + 0.1, 1.8));
  const zoomOut = () => setMapScale(prev => Math.max(prev - 0.1, 0.2));

  // --- FUNZIONE SALVA ZOOM ---
  const salvaZoom = () => {
    localStorage.setItem('belvedere_map_zoom', mapScale.toString());
    alert("🔍 Livello di zoom salvato per questo dispositivo!");
  };

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

  const getPrenotazioniTurno = (tavoloId) => {
    return prenotazioniAttive.filter(p => 
      p.tavoli_assegnati && 
      p.tavoli_assegnati.some(id => String(id) === String(tavoloId)) && 
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
    const presOggi = prenotazioniAttive.filter(p => formatData(p.data_ora) === dataVista && getServizioDaOra(p.data_ora) === servizioVista);
    if (presOggi.length === 0) return alert("Nessuna prenotazione da scaricare.");
    let csvContent = "ORA;CLIENTE;PAX;TAVOLI;STATO;NOTE\n";
    presOggi.forEach(p => {
      const tavoliNomi = (p.tavoli_assegnati || []).map(id => tuttiITavoli.find(t => String(t.id) === String(id))?.numero_tavolo).join(", ") || "-";
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
        if (!window.confirm("⚠️ ATTENZIONE: Questo ripristinerà TAVOLI e PRENOTAZIONI dal file caricato. Procedo?")) { e.target.value = ""; return; }
        if (backupData.tavoli.length > 0) await supabase.from('tavoli').upsert(backupData.tavoli);
        if (backupData.prenotazioni.length > 0) await supabase.from('prenotazioni').upsert(backupData.prenotazioni);
        alert("✅ Ripristino Totale completato con successo!");
        aggiornaTutto();
      } catch (err) { alert("Errore nel ripristino. File non valido o corrotto."); }
      e.target.value = ""; 
    };
    reader.readAsText(file);
  }

  const aggiornaTutto = () => { caricaSale(); caricaPrenotazioni(); caricaTuttiITavoli(); };
  useEffect(() => { if (isLoggedIn) aggiornaTutto(); }, [isLoggedIn]);

  async function caricaSale() {
    let { data } = await supabase.from('sale').select('*').order('ordine');
    if (data?.length > 0) { setSale(data); }
  }
  async function caricaPrenotazioni() {
    let { data } = await supabase.from('prenotazioni').select('*').order('data_ora', { ascending: false });
    if (data) setPrenotazioni(data);
  }
  async function caricaTuttiITavoli() {
    let { data } = await supabase.from('tavoli').select('*');
    if (data) setTuttiITavoli(data);
  }

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
    const t = tuttiITavoli.find(x => String(x.id) === String(tavoloId));
    const pax = window.prompt("Quante persone?", t?.capacita || "2");
    if (!pax) return;

    const now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    if (servizioVista === 'pranzo' && now.getHours() >= 16) { hh = '13'; mm = '00'; }
    if (servizioVista === 'cena' && now.getHours() < 16) { hh = '20'; mm = '00'; }

    const payload = { nome_cliente: 'Senza Prenotazione', numero_persone: parseInt(pax), data_ora: new Date(`${dataVista}T${hh}:${mm}`).toISOString(), tavoli_assegnati: [tavoloId], note: '', presente: true, eliminata: false };
    const { error } = await supabase.from('prenotazioni').insert([payload]);
    if (!error) { aggiornaTutto(); setTavoloInfo(null); } else { alert("Errore nell'occupare il tavolo!"); }
  }

  async function spostaTavoloRapido(prenoId, nuovoTavoloId) {
    if (!nuovoTavoloId) return;
    const targetTable = tuttiITavoli.find(t => String(t.id) === String(nuovoTavoloId));
    if (!targetTable) return alert("Errore: Tavolo non trovato!");
    const { error } = await supabase.from('prenotazioni').update({ tavoli_assegnati: [targetTable.id] }).eq('id', prenoId);
    if (!error) { setPrenoInSpostamento(null); setTavoloInfo(null); aggiornaTutto(); }
  }

  async function togglePresenza(id, statoAttuale) {
    const { error } = await supabase.from('prenotazioni').update({ presente: !statoAttuale }).eq('id', id);
    if (!error) aggiornaTutto();
  }

  async function cestinaPrenotazione(id) {
    if(window.confirm("Spostare questa prenotazione nel cestino?")) {
      const timestamp = new Date().toISOString();
      await supabase.from('prenotazioni').update({ eliminata: true, data_eliminazione: timestamp }).eq('id', id);
      aggiornaTutto();
      setTavoloInfo(null);
    }
  }

  async function ripristinaDaCestino(id) {
    await supabase.from('prenotazioni').update({ eliminata: false, data_eliminazione: null }).eq('id', id);
    aggiornaTutto();
  }

  async function eliminaDefinitivamente(id) {
    if(window.confirm("ATTENZIONE: Eliminare definitivamente? Non potrai più recuperarla!")) {
      await supabase.from('prenotazioni').delete().eq('id', id);
      aggiornaTutto();
    }
  }

  async function aggiungiTavolo() {
    await supabase.from('tavoli').insert([{ sala_id: sale.length > 0 ? sale[0].id : null, numero_tavolo: '?', capacita: 2, pos_x: 200, pos_y: 200, std_x: 200, std_y: 200 }]);
    await caricaTuttiITavoli(); 
  }

  async function aggiungiMuro() {
    await supabase.from('tavoli').insert([{ sala_id: sale.length > 0 ? sale[0].id : null, numero_tavolo: 'MURO_300x20', capacita: 0, pos_x: 200, pos_y: 200, std_x: 200, std_y: 200 }]);
    await caricaTuttiITavoli(); 
  }

  const aggiornaPosizioneLocale = (id, x, y) => { 
      setTuttiITavoli(prev => prev.map(t => String(t.id) === String(id) ? { ...t, pos_x: Math.round(x), pos_y: Math.round(y) } : t)); 
  };

  async function salvaCorrente() {
    const promises = tuttiITavoli.map(t => supabase.from('tavoli').update({ pos_x: t.pos_x, pos_y: t.pos_y }).eq('id', t.id));
    await Promise.all(promises);
    setIsEditMode(false);
    await caricaTuttiITavoli();
    alert("📍 Posizioni salvate su Mappa Unica!");
  }

  async function spostaTuttoADestra() {
    if (!window.confirm("Vuoi spostare TUTTI i tavoli e muri a destra di 150 pixel?")) return;
    const promises = tuttiITavoli.map(t => supabase.from('tavoli').update({ pos_x: Number(t.pos_x) + 150 }).eq('id', t.id));
    await Promise.all(promises);
    alert("➡️ Mappa spostata a destra con successo! Salva come Set Standard se va bene.");
    aggiornaTutto();
  }

  async function recuperaTavoli() {
    if (!window.confirm("Portare tutti i tavoli in alto a sinistra?")) return;
    const promises = tuttiITavoli.map((t, index) => {
        let nx = (index % 8) * 110 + 20;
        let ny = Math.floor(index / 8) * 110 + 20;
        return supabase.from('tavoli').update({ pos_x: nx, pos_y: ny }).eq('id', t.id);
    });
    await Promise.all(promises);
    alert("🧲 Tavoli recuperati con successo!");
    aggiornaTutto();
  }

  async function impostaStandard() {
    if (!window.confirm("Impostare la situazione attuale come STANDARD?")) return;
    const promises = tuttiITavoli.map(t => supabase.from('tavoli').update({ std_x: t.pos_x, std_y: t.pos_y }).eq('id', t.id));
    await Promise.all(promises);
    alert("⭐ Standard salvato!");
    aggiornaTutto();
  }

  async function ripristinaStandard() {
    if (!window.confirm("Tornare alla disposizione STANDARD?")) return;
    const promises = tuttiITavoli.map(t => {
       const targetX = t.std_x !== null ? t.std_x : t.pos_x;
       const targetY = t.std_y !== null ? t.std_y : t.pos_y;
       return supabase.from('tavoli').update({ pos_x: targetX, pos_y: targetY }).eq('id', t.id);
    });
    await Promise.all(promises);
    alert("🔄 Mappa ripristinata!");
    aggiornaTutto();
  }

  const handleLogin = (e) => {
    e.preventDefault();
    const pwd = passInput.toLowerCase().trim();
    if (passInput === "belvedere59") {
      setIsLoggedIn(true); setUserRole('admin');
      if (ricordami) { localStorage.setItem('belvedere_logged_in', 'true'); localStorage.setItem('belvedere_user_role', 'admin'); }
    } else if (pwd === "seba") {
      setIsLoggedIn(true); setUserRole('cameriere');
      if (ricordami) { localStorage.setItem('belvedere_logged_in', 'true'); localStorage.setItem('belvedere_user_role', 'cameriere'); }
    } else { alert("Password errata!"); }
  };

  const resetForm = () => { setEditingId(null); setNomeCliente(''); setNumeroPersone(''); setOraEsatta(''); setNote(''); setTavoliSelezionati([]); setRicerca(''); };

  const ascoltaComando = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Il browser non supporta il riconoscimento vocale.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT'; recognition.interimResults = false;
    recognition.onstart = () => { setIsListening(true); setTestoVocale('Ascolto...'); };
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
    const numeriTestuali = { 'uno': '1', 'un': '1', 'una': '1', 'due': '2', 'tre': '3', 'quattro': '4', 'cinque': '5', 'sei': '6', 'sette': '7', 'otto': '8', 'nove': '9', 'dieci': '10', 'undici': '11', 'dodici': '12', 'tredici': '13', 'quattordici': '14', 'quindici': '15', 'sedici': '16', 'diciassette': '17', 'diciotto': '18', 'diciannove': '19', 'venti': '20' };
    Object.keys(numeriTestuali).forEach(parola => { frase = frase.replace(new RegExp(`\\b${parola}\\b`, 'gi'), numeriTestuali[parola]); });

    let fraseSenzaDati = frase;
    let pax = ''; const matchPersone = fraseSenzaDati.match(/(\d+)\s*person/i);
    if (matchPersone) { pax = matchPersone[1]; fraseSenzaDati = fraseSenzaDati.replace(matchPersone[0], ''); }

    let ora = ''; const matchOra = fraseSenzaDati.match(/(?:ore|alle|le)\s*(\d{1,2})(?:[\:\s\.]*(?:e\s*)?(\d{2}))?/i);
    if (matchOra) {
      let hh = parseInt(matchOra[1], 10);
      let computedServizio = hh < 16 ? 'pranzo' : 'cena';
      if (computedServizio === 'pranzo' && hh >= 7 && hh <= 11 && fraseSenzaDati.includes('cena')) { hh += 12; computedServizio = 'cena'; } 
      else if (hh >= 7 && hh <= 11 && computedServizio === 'pranzo') { hh += 12; computedServizio = 'cena'; }
      setServizioVista(computedServizio);
      ora = `${String(hh).padStart(2, '0')}:${matchOra[2] ? matchOra[2].padStart(2, '0') : '00'}`;
      fraseSenzaDati = fraseSenzaDati.replace(matchOra[0], '');
    }

    let dateToSet = formatData(new Date().toISOString()); 
    let baseDate = new Date();
    let m1 = fraseSenzaDati.match(/(?:(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|giorno)\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i);
    let m2 = !m1 ? fraseSenzaDati.match(/(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|giorno)\s+(\d{1,2})\b/i) : null;

    if (/\bdomani\b/i.test(fraseSenzaDati)) { baseDate.setDate(baseDate.getDate() + 1); dateToSet = formatData(baseDate.toISOString()); fraseSenzaDati = fraseSenzaDati.replace(/\bdomani\b/i, ''); } 
    else if (/\boggi\b/i.test(fraseSenzaDati)) { dateToSet = formatData(baseDate.toISOString()); fraseSenzaDati = fraseSenzaDati.replace(/\boggi\b/i, ''); } 
    else if (m1 || m2) {
        let dayMatch = m1 ? parseInt(m1[1], 10) : parseInt(m2[2], 10);
        let monthMatchStr = m1 ? m1[2].toLowerCase() : null;
        let matchStrToRemove = m1 ? m1[0] : m2[0];
        let monthMatch = baseDate.getMonth();
        if (monthMatchStr) monthMatch = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'].indexOf(monthMatchStr);
        let targetDate = new Date(baseDate.getFullYear(), monthMatch, dayMatch);
        if (targetDate < new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())) {
            if (monthMatchStr) targetDate.setFullYear(targetDate.getFullYear() + 1);
            else targetDate.setMonth(targetDate.getMonth() + 1);
        }
        dateToSet = formatData(targetDate.toISOString());
        fraseSenzaDati = fraseSenzaDati.replace(matchStrToRemove, '');
    }
    setDataVista(dateToSet); 

    let foundTableIds = []; const matchTavolo = fraseSenzaDati.match(/tavolo\s*([\d\.]+)/i);
    if (matchTavolo) {
       const targetTable = tuttiITavoli.find(t => String(t.numero_tavolo) === String(matchTavolo[1]));
       if (targetTable) foundTableIds.push(targetTable.id);
       fraseSenzaDati = fraseSenzaDati.replace(matchTavolo[0], '');
    }
    setTavoliSelezionati(foundTableIds);

    let nomePulito = fraseSenzaDati.replace(/\baggiungi\b|\binserisci\b|\bnuova\b|\bprenota\b|\bprenotazione\b|\bal\b|\bil\b|\bper\b/gi, '').replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
    const nomeFinale = nomePulito.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
    setNomeCliente(nomeFinale || '');
    if (pax) setNumeroPersone(pax);
    if (ora && generaOrari().includes(ora)) setOraEsatta(ora); else if (ora) setOraEsatta(ora); 
  };

  const clickTavoloSfondo = (id) => {
    if (isEditMode) return;
    if (oraEsatta) setTavoliSelezionati(prev => prev.includes(id) ? prev.filter(t => String(t) !== String(id)) : [...prev, id]);
    else setTavoloInfo(id);
  };

  async function modificaInfoTavolo(t) {
    if (!t || !isAdmin) return;
    if (String(t.numero_tavolo).startsWith('MURO')) {
      const dims = window.prompt("Modifica dimensioni MURO (Larghezza x Altezza):", t.numero_tavolo.replace('MURO_', ''));
      if (dims) { await supabase.from('tavoli').update({ numero_tavolo: `MURO_${dims}` }).eq('id', t.id); aggiornaTutto(); }
      return;
    }
    const n = window.prompt("Nome tavolo:", t.numero_tavolo); if (n === null) return;
    const p = window.prompt("Capacità posti:", t.capacita); if (p === null) return;
    if (n && p) { await supabase.from('tavoli').update({ numero_tavolo: n, capacita: parseInt(p) }).eq('id', t.id); aggiornaTutto(); }
  }

  const tuttiITavoliOrdinati = [...(tuttiITavoli || [])].filter(t => !String(t.numero_tavolo).startsWith('MURO')).sort((a, b) => parseInt(a.numero_tavolo) - parseInt(b.numero_tavolo));
  const prenotazioniDelServizio = prenotazioniAttive.filter(p => formatData(p.data_ora) === dataVista && getServizioDaOra(p.data_ora) === servizioVista);
  const totalePaxServizio = prenotazioniDelServizio.reduce((acc, p) => acc + (p.numero_persone || 0), 0);
  const risultatiRicerca = ricerca.length > 1 ? prenotazioniAttive.filter(p => p.nome_cliente && p.nome_cliente.toLowerCase().includes(ricerca.toLowerCase())) : [];

  const mergedReservations = prenotazioniDelServizio.filter(p => p.tavoli_assegnati && p.tavoli_assegnati.length > 1);
  const mergedTableIds = new Set();
  if (!isEditMode) {
    mergedReservations.forEach(p => (p.tavoli_assegnati || []).forEach(id => mergedTableIds.add(String(id))));
  }

  const calcolaStatistiche = () => {
    const oggiStr = formatData(new Date().toISOString());
    const presOggi = prenotazioniAttive.filter(p => formatData(p.data_ora) === oggiStr);
    const paxOggi = presOggi.reduce((sum, p) => sum + p.numero_persone, 0);
    const tavoliOggi = presOggi.length;
    
    const setteGiorniFa = new Date();
    setteGiorniFa.setDate(setteGiorniFa.getDate() - 7);
    const presSettimana = prenotazioniAttive.filter(p => new Date(p.data_ora) >= setteGiorniFa && formatData(p.data_ora) <= oggiStr);
    const paxSettimana = presSettimana.reduce((sum, p) => sum + p.numero_persone, 0);

    return { paxOggi, tavoliOggi, paxSettimana, presOggi };
  };
  const stats = showStatistiche ? calcolaStatistiche() : null;

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f6f8' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '85%', maxWidth: '350px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <img src="/logo.png" alt="Belvedere" style={{ height: '90px', display: 'block', margin: '0 auto 20px auto', objectFit: 'contain' }} />
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '25px', fontSize: '14px' }}>Inserisci la password di accesso</p>
          <input type="password" placeholder="Password..." value={passInput} onChange={e => setPassInput(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
          <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="ric" checked={ricordami} onChange={e => setRicordami(e.target.checked)} style={{ width: '20px', height: '20px' }} /> <label htmlFor="ric">Ricordami</label>
          </div>
          <button type="submit" style={{ width: '100%', padding: '15px', background: '#d4af37', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', marginTop: '20px', cursor: 'pointer', fontSize: '16px' }}>ACCEDI</button>
        </form>
      </div>
    );
  }

  // COMPONENTI UI
  const SezioneForm = (
    <div style={{ background: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', flexShrink: 0 }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
        <h3 style={{margin: 0, fontSize: '16px', color: '#333'}}>Nuova Prenotazione</h3>
        {editingId && <button onClick={resetForm} style={{padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px'}}>Annulla</button>}
      </div>
      <form onSubmit={salvaPrenotazione} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="text" placeholder="Nome Cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #ced4da', fontSize: '15px', width: '100%', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <input type="number" placeholder="Pax" value={numeroPersone} onChange={e => setNumeroPersone(e.target.value)} required style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ced4da', fontSize: '15px', boxSizing: 'border-box' }} />
          <select value={oraEsatta} onChange={e => setOraEsatta(e.target.value)} required style={{ flex: 1.5, padding: '12px', borderRadius: '12px', border: '1px solid #ced4da', fontSize: '15px', fontWeight: 'bold', boxSizing: 'border-box' }}>
            <option value="">Ora...</option>
            {generaOrari().map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <textarea placeholder="Note..." value={note} onChange={e => setNote(e.target.value)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #ced4da', minHeight: '40px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
        
        <select value="" onChange={(e) => { 
            const val = e.target.value; 
            const targetTable = tuttiITavoliOrdinati.find(t => String(t.id) === String(val));
            if (targetTable && !tavoliSelezionati.includes(targetTable.id)) setTavoliSelezionati(prev => [...prev, targetTable.id]);
        }} style={{ padding: '12px', borderRadius: '12px', border: '2px solid #e7f1ff', fontSize: '15px', fontWeight: 'bold', width: '100%', boxSizing: 'border-box' }}>
          <option value="">➕ Assegna Tavolo...</option>
          {tuttiITavoliOrdinati.map(t => {
             const isFree = getPrenotazioniTurno(t.id).length === 0;
             return <option key={t.id} value={t.id}>Tav. {t.numero_tavolo} - {isFree ? "🟢 Libero" : "🟠 Occupato"}</option>
          })}
        </select>
        
        {tavoliSelezionati.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tavoliSelezionati.map(id => (
                <div key={id} onClick={() => setTavoliSelezionati(prev => prev.filter(x => String(x) !== String(id)))} style={{ background: '#0d6efd', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Tav. {(tuttiITavoli || []).find(x => String(x.id) === String(id))?.numero_tavolo} ✖
                </div>
              ))}
            </div>
        )}
        <button type="submit" style={{ padding: '14px', background: editingId ? '#ffc107' : '#1a73e8', color: editingId ? 'black' : 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
            {editingId ? "💾 AGGIORNA PRENOTAZIONE" : "💾 SALVA PRENOTAZIONE"}
        </button>
      </form>
    </div>
  );

  const SezioneMappa = (
    <div style={isFullscreen ? {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, 
      backgroundColor: '#f4f6f8', padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px'
    } : { 
      display: 'flex', flexDirection: 'column', gap: '10px', minHeight: isMobile ? '60vh' : '100%', position: 'relative', flexShrink: 0 
    }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '8px 12px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
          <button onClick={() => setIsFullscreen(!isFullscreen)} style={{ ...mapBtnStyle, background: '#1a73e8', flex: isMobile ? '1' : 'none' }}>
            {isFullscreen ? "❌ Chiudi" : "🖥️ Espandi"}
          </button>
          
          {isAdmin && (
            <button onClick={() => setIsEditMode(!isEditMode)} style={{ ...mapBtnStyle, background: isEditMode ? '#28a745' : '#dc3545', flex: isMobile ? '1' : 'none' }}>
              {isEditMode ? "🔓 Modifica ON" : "🔒 Modifica Mappa"}
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8f9fa', padding: '4px 10px', borderRadius: '20px', border: '1px solid #ddd', margin: isMobile ? '0 auto' : '0' }}>
            <span style={{ fontSize: '13px', color: '#666', fontWeight: 'bold' }}>ZOOM:</span>
            <button onClick={zoomOut} style={{ background: 'white', border: '1px solid #ccc', borderRadius: '50%', width: zoomBtnSize, height: zoomBtnSize, fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>-</button>
            <button onClick={zoomIn} style={{ background: 'white', border: '1px solid #ccc', borderRadius: '50%', width: zoomBtnSize, height: zoomBtnSize, fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>+</button>
            <button onClick={salvaZoom} style={{ background: '#28a745', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px' }}>💾 Salva</button>
        </div>
      </div>

      {isAdmin && isEditMode && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <button onClick={aggiungiTavolo} style={{ ...topBtnStyle, background: '#0d6efd', color: 'white' }}>➕ Tavolo</button>
            <button onClick={aggiungiMuro} style={{ ...topBtnStyle, background: '#495057', color: 'white' }}>🧱 Muro</button>
            <button onClick={salvaCorrente} style={{ ...topBtnStyle, background: '#28a745', color: 'white' }}>📍 Salva Posizioni</button>
            <button onClick={spostaTuttoADestra} style={{ ...topBtnStyle, background: '#17a2b8', color: 'white' }}>➡️ Sposta a Destra</button>
            <button onClick={impostaStandard} style={{ ...topBtnStyle, background: '#f3e8ff', color: '#6f42c1' }}>⭐ Set Std</button>
            <button onClick={ripristinaStandard} style={{ ...topBtnStyle, background: '#fff8e1', color: '#d39e00' }}>🔄 R. Std</button>
            <button onClick={recuperaTavoli} style={{ ...topBtnStyle, background: '#ffc107', color: 'black' }}>🧲 Recupera</button>
        </div>
      )}

      <div ref={mapContainerRef} style={{ flex: 1, backgroundColor: '#e9ecef', borderRadius: '16px', border: '2px solid #dee2e6', overflow: 'auto', position: 'relative' }}>
        <div style={{ width: VIRTUAL_WIDTH * mapScale, height: VIRTUAL_HEIGHT * mapScale }}>
          <div style={{ width: `${VIRTUAL_WIDTH}px`, height: `${VIRTUAL_HEIGHT}px`, transform: `scale(${mapScale})`, transformOrigin: 'top left', position: 'relative' }}>
            
            {!isEditMode && mergedReservations.map(p => {
               const assignedTables = tuttiITavoli.filter(t => (p.tavoli_assegnati || []).some(tid => String(tid) === String(t.id)) && !String(t.numero_tavolo).startsWith('MURO'));
               if (assignedTables.length < 2) return null;
               
               const minX = Math.min(...assignedTables.map(t => Number(t.pos_x) || 0));
               const minY = Math.min(...assignedTables.map(t => Number(t.pos_y) || 0));
               const maxX = Math.max(...assignedTables.map(t => Number(t.pos_x) || 0));
               const maxY = Math.max(...assignedTables.map(t => Number(t.pos_y) || 0));
               const width = (maxX - minX) + 90; 
               const height = (maxY - minY) + 90;

               let bgCol = '#fd7e14'; let bCol = '#d35400';
               if (p.presente) { bgCol = '#d1e7dd'; bCol = '#28a745'; } 

               return (
                 <div key={`mega-${p.id}`}
                      onClick={(e) => { e.stopPropagation(); setTavoloInfo(assignedTables[0].id); }}
                      style={{ position: 'absolute', top: minY, left: minX, width: width, height: height, background: bgCol, border: `4px solid ${bCol}`, borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, opacity: 0.95, boxShadow: '0px 10px 20px rgba(0,0,0,0.2)' }}>
                   <strong style={{ fontSize: '20px', marginBottom: '8px', color: '#333' }}>Tav. {assignedTables.map(t => t.numero_tavolo).join(' + ')}</strong>
                   <div style={{ fontSize: '14px', background: p.presente ? '#28a745' : 'rgba(0,0,0,0.75)', color: 'white', padding: '6px 12px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                       {formatOra(p.data_ora)} - {p.nome_cliente} <br/> ({p.numero_persone}p)
                   </div>
                 </div>
               )
            })}

            {tuttiITavoli.map(t => {
              const isMuro = String(t.numero_tavolo).startsWith('MURO');
              const isMergedHidden = !isEditMode && mergedTableIds.has(String(t.id)) && !isMuro;

              if (isMergedHidden) return null;

              if (isMuro) {
                 let w = 150, h = 20;
                 const match = String(t.numero_tavolo).match(/MURO_(\d+)x(\d+)/i);
                 if (match) { w = parseInt(match[1]); h = parseInt(match[2]); }
                 
                 return (
                   <Draggable key={t.id} disabled={!isEditMode} scale={mapScale} bounds="parent" position={{ x: Number(t.pos_x) || 50, y: Number(t.pos_y) || 50 }} onStop={(e, d) => aggiornaPosizioneLocale(t.id, d.x, d.y)}>
                     <div style={{ position: 'absolute', top: 0, left: 0, width: `${w}px`, height: `${h}px`, backgroundColor: '#495057', borderRadius: '6px', cursor: isEditMode ? 'move' : 'default', zIndex: 1, border: '1px solid #343a40' }}>
                       {isAdmin && isEditMode && (
                          <>
                            <button onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); e.preventDefault(); modificaInfoTavolo(t); }} style={{ position: 'absolute', top: '-15px', left: '-15px', background: '#f8f9fa', color: '#0d6efd', border: '2px solid #0d6efd', borderRadius: '50%', width: '30px', height: '30px', fontSize: '14px', zIndex: 10 }}>⚙️</button>
                            <button onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onClick={async e => { e.stopPropagation(); e.preventDefault(); if(window.confirm("Eliminare muro?")) { await supabase.from('tavoli').delete().eq('id', t.id); aggiornaTutto(); } }} style={{ position: 'absolute', top: '-15px', right: '-15px', background: '#dc3545', color: 'white', border: '2px solid white', borderRadius: '50%', width: '30px', height: '30px', fontSize: '14px', zIndex: 10 }}>✖</button>
                          </>
                       )}
                     </div>
                   </Draggable>
                 );
              }

              const pres = getPrenotazioniTurno(t.id);
              const sel = tavoliSelezionati.includes(t.id);
              let bgCol = 'white'; let bCol = '#adb5bd';
              if (sel) { bgCol = '#cfe2ff'; bCol = '#0d6efd'; } 
              else if (pres.length > 1) { bgCol = '#dc3545'; bCol = '#a71d2a'; } 
              else if (pres.some(p => p.presente)) { bgCol = '#d1e7dd'; bCol = '#28a745'; } 
              else if (pres.length === 1) { bgCol = '#fd7e14'; bCol = '#d35400'; } 

              return (
                <Draggable key={t.id} disabled={!isEditMode} scale={mapScale} bounds="parent" position={{ x: Number(t.pos_x) || 50, y: Number(t.pos_y) || 50 }} onStop={(e, d) => aggiornaPosizioneLocale(t.id, d.x, d.y)}>
                  <div onClick={(e) => { e.stopPropagation(); if (!isEditMode) clickTavoloSfondo(t.id); }}
                       onMouseDown={(e) => { if(isEditMode) e.stopPropagation(); }}
                       onTouchStart={(e) => { if(isEditMode) e.stopPropagation(); }}
                       style={{ position: 'absolute', top: 0, left: 0, width: '90px', height: '90px', borderRadius: '15px', background: bgCol, border: `3px solid ${bCol}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: isEditMode ? 'move' : 'pointer', touchAction: 'none', zIndex: 5 }}>
                    
                    {isAdmin && isEditMode && (
                      <>
                        <button onMouseDown={(e) => { e.stopPropagation(); }} onTouchStart={(e) => { e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); e.preventDefault(); modificaInfoTavolo(t); }} style={{ position: 'absolute', top: '-18px', left: '-18px', zIndex: 9999, background: '#f8f9fa', color: '#0d6efd', border: '2px solid #0d6efd', borderRadius: '50%', width: '30px', height: '30px', fontSize: '15px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
                        <button onMouseDown={(e) => { e.stopPropagation(); }} onTouchStart={(e) => { e.stopPropagation(); }} onClick={async (e) => { e.stopPropagation(); e.preventDefault(); if(window.confirm("Eliminare definitivamente il tavolo?")) { await supabase.from('tavoli').delete().eq('id', t.id); aggiornaTutto(); } }} style={{ position: 'absolute', top: '-18px', right: '-18px', zIndex: 9999, background: '#dc3545', color: 'white', border: '2px solid white', borderRadius: '50%', width: '30px', height: '30px', fontSize: '15px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✖</button>
                      </>
                    )}

                    <strong style={{ fontSize: `${dimensioneTestoTavolo}px`, marginBottom: '2px', color: (bgCol === '#dc3545') ? 'white' : '#333' }}>{t.numero_tavolo}</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '95%' }}>
                      {pres.map(p => (
                        <div key={p.id} onClick={(e) => { e.stopPropagation(); if(!isEditMode) setTavoloInfo(t.id); }} style={{ fontSize: `10px`, background: p.presente ? '#28a745' : 'rgba(0,0,0,0.75)', color: 'white', padding: '2px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: p.presente ? '1px solid white' : 'none', lineHeight: '1.2' }}>
                          {formatOra(p.data_ora)} - {p.nome_cliente.substring(0,6)}
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

  const SezioneAgenda = (
    <div style={{ background: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', marginBottom: isMobile ? '100px' : '0' }}>
      <input type="text" placeholder="🔍 Ricerca cliente..." value={ricerca} onChange={e => setRicerca(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ced4da', fontSize: '15px', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />
      
      {ricerca.length > 1 ? (
        <div>
          <h3 style={{ fontSize: '15px', color: '#1a73e8', margin: '10px 0' }}>Risultati:</h3>
          {risultatiRicerca.map(p => (
            <div key={p.id} style={{ padding: '10px', borderBottom: '1px solid #eee', background: p.presente ? '#e6f4ea' : '#f8f9fa', borderRadius: '10px', marginBottom: '8px' }}>
              <b style={{color: p.presente ? '#28a745' : '#333'}}>{formatDataLeggibile(p.data_ora)}</b> - <b style={{color: p.presente ? '#28a745' : '#333'}}>{p.nome_cliente}</b> ({p.numero_persone}p)
              
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button onClick={() => togglePresenza(p.id, p.presente)} style={{ flex: 1, border: p.presente ? '2px solid #28a745' : '1px solid #ddd', background: p.presente ? '#28a745' : '#fff', color: p.presente ? 'white' : '#666', padding: '6px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{p.presente ? '✅ ARRIVATO' : 'ATTESA'}</button>
                
                {prenoInSpostamento === p.id ? (
                  <select onChange={(e) => spostaTavoloRapido(p.id, e.target.value)} style={{ flex: 1, padding: '6px', borderRadius: '8px', border: '2px solid #fd7e14' }}>
                    <option value="">A Tavolo...</option>
                    {tuttiITavoliOrdinati.map(tav => <option key={tav.id} value={tav.id}>Tav. {tav.numero_tavolo}</option>)}
                  </select>
                ) : (
                  <button onClick={() => setPrenoInSpostamento(p.id)} style={{ flex: 1, background: '#fd7e14', color: 'white', border: 'none', padding: '6px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 SPOSTA</button>
                )}
                
                <button onClick={() => { setEditingId(p.id); setNomeCliente(p.nome_cliente); setNumeroPersone(p.numero_persone); setDataVista(formatData(p.data_ora)); setServizioVista(getServizioDaOra(p.data_ora)); setOraEsatta(formatOra(p.data_ora)); setNote(p.note || ''); setTavoliSelezionati(p.tavoli_assegnati || []); setRicerca(''); window.scrollTo(0,0); }} style={{ flex: 1, border: 'none', background: '#1a73e8', color: 'white', padding: '6px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✏️ MOD</button>
                {isAdmin && (
                  <button onClick={() => cestinaPrenotazione(p.id)} style={{ border: 'none', background: '#fff0f0', color: '#dc3545', padding: '6px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🗑️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <h3 style={{ fontSize: '16px', marginBottom: '10px', marginTop: 0 }}>Agenda {servizioVista} <span style={{ color: '#1a73e8' }}>({totalePaxServizio} pax)</span></h3>
          {(sale || []).map(reparto => {
            const presRep = prenotazioniDelServizio.filter(p => p.tavoli_assegnati && p.tavoli_assegnati.some(tid => (tuttiITavoli || []).find(x => String(x.id) === String(tid))?.sala_id === reparto.id));
            if (presRep.length === 0) return null;
            return (
              <div key={reparto.id} style={{ marginTop: '10px' }}>
                <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '8px', borderLeft: '4px solid #1a73e8', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <b style={{textTransform: 'uppercase'}}>{reparto.nome}</b> <b>{presRep.reduce((a,b) => a + b.numero_persone, 0)} pax</b>
                </div>
                {presRep.map(p => (
                  <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f3f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: p.presente ? '#f0fdf4' : 'transparent', borderRadius: '8px' }}>
                    <div style={{flex: 1, paddingLeft: '5px'}}>
                      <b style={{color: p.presente ? '#28a745' : '#333', fontSize: '15px'}}>{formatOra(p.data_ora)}</b> - <span style={{color: p.presente ? '#28a745' : '#333', fontWeight: p.presente ? 'bold' : 'normal', fontSize: '15px'}}>{p.nome_cliente} ({p.numero_persone}p)</span>
                      <div style={{fontSize: '11px', color: '#666'}}>Tavoli: {(p.tavoli_assegnati || []).map(id => (tuttiITavoli || []).find(x => String(x.id) === String(id))?.numero_tavolo).join(", ")}</div>
                    </div>
                    <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', width: '45%'}}>
                      <button onClick={() => togglePresenza(p.id, p.presente)} style={{ border: 'none', background: p.presente ? '#28a745' : '#e9ecef', color: p.presente ? 'white' : '#666', padding: '6px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{p.presente ? '✅' : '⏳'}</button>
                      
                      {prenoInSpostamento === p.id ? (
                        <select onChange={(e) => spostaTavoloRapido(p.id, e.target.value)} style={{ padding: '4px', borderRadius: '8px', border: '2px solid #fd7e14', fontSize: '11px', maxWidth: '80px' }}>
                          <option value="">A Tav...</option>
                          {tuttiITavoliOrdinati.map(tav => <option key={tav.id} value={tav.id}>T.{tav.numero_tavolo}</option>)}
                        </select>
                      ) : (
                        <button onClick={() => setPrenoInSpostamento(p.id)} style={{ border: 'none', background: '#fd7e14', color: 'white', padding: '6px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>🔄</button>
                      )}
                      
                      <button onClick={() => { setEditingId(p.id); setNomeCliente(p.nome_cliente); setNumeroPersone(p.numero_persone); setOraEsatta(formatOra(p.data_ora)); setNote(p.note || ''); setTavoliSelezionati(p.tavoli_assegnati || []); window.scrollTo(0,0); }} style={{ border: 'none', background: '#e7f1ff', padding: '6px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>✏️</button>
                      {isAdmin && (
                        <button onClick={() => cestinaPrenotazione(p.id)} style={{ border: 'none', background: '#fff0f0', padding: '6px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>🗑️</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ backgroundColor: '#f4f6f8', height: '100vh', padding: '10px', boxSizing: 'border-box', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={importaBackup} />

      {/* HEADER GLOBALE */}
      <div style={{ background: 'white', padding: '12px 15px', borderRadius: '16px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', flexShrink: 0 }}>
        
        {/* RIGA 1: Logo e Bottoni scorrevoli */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center', gap: '15px' }}>
          <img src="/logo.png" alt="Belvedere" style={{ height: isMobile ? '40px' : '50px', objectFit: 'contain', flexShrink: 0 }} />

          {/* Wrapper per lo scroll orizzontale dei bottoni su mobile */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', flexGrow: 1, WebkitOverflowScrolling: 'touch' }}>
             {isAdmin && <button onClick={() => setShowStatistiche(true)} style={{ ...topBtnStyle, background: '#6c757d', color: 'white' }}>📈 Statistiche</button>}
             {isAdmin && <button onClick={() => setShowCestino(true)} style={{ ...topBtnStyle, background: '#343a40', color: 'white' }}>🗑️ Cestino</button>}
             {isAdmin && <button onClick={esportaBackup} style={{ ...topBtnStyle, background: '#17a2b8', color: 'white' }}>💾 Backup DB</button>}
             {isAdmin && <button onClick={() => { if(fileInputRef.current) fileInputRef.current.click() }} style={{ ...topBtnStyle, background: '#e83e8c', color: 'white' }}>📂 Carica DB</button>}
             <button onClick={() => setShowDisponibilita(true)} style={{ ...topBtnStyle, background: '#17a2b8', color: 'white', boxShadow: '0 2px 5px rgba(23,162,184,0.3)' }}>📊 Disponibilità</button>
             <button onClick={ascoltaComando} style={{ ...topBtnStyle, background: isListening ? '#dc3545' : '#6f42c1', color: 'white', boxShadow: isListening ? '0 0 10px #dc3545' : 'none' }}>{isListening ? '🎙️ Ascolta...' : '🎤 Voce'}</button>
             {isAdmin && <button onClick={scaricaAgendaFile} style={{ ...topBtnStyle, background: '#e7f1ff', color: '#0d6efd' }}>📥 AGENDA</button>}
             <button onClick={() => { setIsLoggedIn(false); localStorage.removeItem('belvedere_logged_in'); localStorage.removeItem('belvedere_user_role'); }} style={{ ...topBtnStyle, background: '#f8f9fa', color: '#dc3545', border: '1px solid #ddd' }}>Esci</button>
          </div>
        </div>

        {/* RIGA 2: Data e Servizio */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="date" value={dataVista} onChange={e => setDataVista(e.target.value)} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '14px', flexShrink: 0 }} />
          <div style={{ background: '#f1f3f5', borderRadius: '12px', padding: '4px', display: 'flex', gap: '4px' }}>
            <button onClick={() => setServizioVista('pranzo')} style={{ padding: '8px 16px', border: 'none', borderRadius: '10px', background: servizioVista === 'pranzo' ? 'white' : 'transparent', color: servizioVista === 'pranzo' ? '#1a73e8' : '#555', fontSize: '13px', fontWeight: 'bold', boxShadow: servizioVista === 'pranzo' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}>PRANZO</button>
            <button onClick={() => setServizioVista('cena')} style={{ padding: '8px 16px', border: 'none', borderRadius: '10px', background: servizioVista === 'cena' ? 'white' : 'transparent', color: servizioVista === 'cena' ? '#1a73e8' : '#555', fontSize: '13px', fontWeight: 'bold', boxShadow: servizioVista === 'cena' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}>CENA</button>
          </div>
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', flexGrow: 1, paddingBottom: '90px' }}>
          {SezioneForm}
          {!isFullscreen && SezioneMappa}
          {SezioneAgenda}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '15px', flexGrow: 1, overflow: 'hidden' }}>
          <div style={{ flex: '0 0 32%', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'auto', paddingRight: '5px' }}>
             {SezioneForm}
             {SezioneAgenda}
          </div>
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
             {!isFullscreen && SezioneMappa}
          </div>
        </div>
      )}
      
      {isFullscreen && SezioneMappa}

      {/* POP-UP TAVOLO DETTAGLIO */}
      {tavoloInfo && (() => {
        const presSulTavolo = getPrenotazioniTurno(tavoloInfo);
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => { setTavoloInfo(null); setPrenoInSpostamento(null); }}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <h2 style={{ marginTop: 0, fontSize: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Tavolo {(tuttiITavoli || []).find(x => String(x.id) === String(tavoloInfo))?.numero_tavolo}</h2>
              
              {presSulTavolo.length > 0 && (
                <div style={{ margin: '15px 0' }}>
                  {presSulTavolo.map(p => (
                    <div key={p.id} style={{ background: p.presente ? '#e6f4ea' : '#f8f9fa', padding: '12px', borderRadius: '12px', marginBottom: '10px', border: '1px solid #eee' }}>
                      <b style={{color: p.presente ? '#28a745' : '#333'}}>{formatOra(p.data_ora)}</b> - <span style={{color: p.presente ? '#28a745' : '#333', fontWeight: p.presente ? 'bold' : 'normal'}}>{p.nome_cliente} ({p.numero_persone}p)</span>
                      
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                        <button onClick={() => togglePresenza(p.id, p.presente)} style={{ flex: 1, background: p.presente ? '#28a745' : '#fff', color: p.presente ? 'white' : '#666', padding: '8px', borderRadius: '8px', fontWeight: 'bold', border: '1px solid #ddd', cursor: 'pointer' }}>{p.presente ? '✅' : 'ATTESA'}</button>
                        
                        {prenoInSpostamento === p.id ? (
                          <select onChange={(e) => spostaTavoloRapido(p.id, e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid #fd7e14' }}><option value="">A Tavolo...</option>{tuttiITavoliOrdinati.map(tav => <option key={tav.id} value={tav.id}>T. {tav.numero_tavolo}</option>)}</select>
                        ) : (
                          <button onClick={() => setPrenoInSpostamento(p.id)} style={{ flex: 1, background: '#fd7e14', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 SPOSTA</button>
                        )}
                        
                        <button onClick={() => { setEditingId(p.id); setNomeCliente(p.nome_cliente); setNumeroPersone(p.numero_persone); setOraEsatta(formatOra(p.data_ora)); setNote(p.note || ''); setTavoliSelezionati(p.tavoli_assegnati || []); setTavoloInfo(null); window.scrollTo(0,0); setIsFullscreen(false); }} style={{ flex: 0.5, padding: '8px', borderRadius: '8px', border: 'none', background: '#1a73e8', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>✏️</button>
                        {isAdmin && (
                          <button onClick={() => cestinaPrenotazione(p.id)} style={{ flex: 0.5, padding: '8px', borderRadius: '8px', border: 'none', background: '#dc3545', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>🗑️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => occupaTavoloVeloce(tavoloInfo)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#28a745', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>🚶 OCCUPA SUBITO</button>
                <button onClick={() => { setTavoliSelezionati([tavoloInfo]); setTavoloInfo(null); window.scrollTo(0,0); setIsFullscreen(false); }} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #1a73e8', background: 'white', color: '#1a73e8', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>➕ NUOVA PRENOTAZIONE</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POP-UP DISPONIBILITÀ GLOBALE */}
      {showDisponibilita && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }} onClick={() => setShowDisponibilita(false)}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '100%', maxWidth: '1000px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '15px', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }}>
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
            
            <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '10px' }}>
              {(sale || []).map(s => {
                 const tavoliSala = tuttiITavoliOrdinati.filter(t => t.sala_id === s.id);
                 if (tavoliSala.length === 0) return null;
                 
                 return (
                   <div key={s.id} style={{ marginBottom: '35px' }}>
                     <h3 style={{ background: '#f8f9fa', padding: '12px', borderRadius: '12px', borderLeft: '5px solid #1a73e8', marginTop: 0 }}>{s.nome.toUpperCase()}</h3>
                     
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '10px' }}>
                       {tavoliSala.map(t => {
                         const pres = getPrenotazioniTurno(t.id);
                         const isFree = pres.length === 0;
                         const isDouble = pres.length > 1;
                         
                         let bgC = '#f0fdf4'; let borderC = '#28a745';
                         if (isDouble) { bgC = '#f8d7da'; borderC = '#dc3545'; } 
                         else if (!isFree) { bgC = '#fff8e1'; borderC = '#fd7e14'; } 

                         return (
                           <div key={t.id} onClick={() => { setTavoloInfo(t.id); setShowDisponibilita(false); }} style={{ padding: '10px 5px', borderRadius: '10px', border: `2px solid ${borderC}`, background: bgC, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.1s', ':hover': { transform: 'scale(1.05)' } }}>
                             <strong style={{ fontSize: '15px', color: isDouble ? '#dc3545' : '#333' }}>Tav. {t.numero_tavolo}</strong>
                             <div style={{ fontSize: '11px', marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                               {isFree ? (
                                 <span style={{ color: '#28a745', fontWeight: 'bold' }}>🟢 LIBERO</span>
                               ) : (
                                 pres.map(p => (
                                   <div key={p.id} style={{ color: isDouble ? 'white' : '#d35400', fontWeight: 'bold', background: isDouble ? '#dc3545' : '#ffe8cc', padding: '3px', borderRadius: '4px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                     {formatOra(p.data_ora)} {p.nome_cliente}
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
        </div>
      )}

      {/* POP-UP STATISTICHE */}
      {showStatistiche && stats && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }} onClick={() => setShowStatistiche(false)}>
          <div style={{ background: 'white', padding: '35px', borderRadius: '20px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
             <h2 style={{ margin: '0 0 20px 0', color: '#1a73e8', textAlign: 'center', fontSize: '28px' }}>📈 Statistiche Belvedere</h2>
             
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '15px', textAlign: 'center', border: '1px solid #eee' }}>
                   <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#28a745' }}>{stats.paxOggi}</div>
                   <div style={{ fontSize: '14px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Coperti Oggi</div>
                </div>
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '15px', textAlign: 'center', border: '1px solid #eee' }}>
                   <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#17a2b8' }}>{stats.tavoliOggi}</div>
                   <div style={{ fontSize: '14px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Tavoli Prenotati Oggi</div>
                </div>
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '15px', textAlign: 'center', border: '1px solid #eee', gridColumn: 'span 2' }}>
                   <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#6f42c1' }}>{stats.paxSettimana}</div>
                   <div style={{ fontSize: '14px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Coperti Ultimi 7 Giorni</div>
                </div>
             </div>

             <button onClick={() => setShowStatistiche(false)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '15px 20px', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', width: '100%' }}>CHIUDI</button>
          </div>
        </div>
      )}

      {/* POP-UP CESTINO */}
      {showCestino && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }} onClick={() => setShowCestino(false)}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
               <h2 style={{ margin: 0, color: '#343a40' }}>🗑️ Cestino Prenotazioni</h2>
               <button onClick={() => setShowCestino(false)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>CHIUDI ✖</button>
             </div>
             
             <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '10px' }}>
                {prenotazioniEliminate.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#666', marginTop: '40px' }}>Il cestino è vuoto.</p>
                ) : (
                  prenotazioniEliminate.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '12px', marginBottom: '10px', borderLeft: '5px solid #dc3545', flexWrap: 'wrap', gap: '10px' }}>
                       <div>
                          <strong style={{ fontSize: '16px', display: 'block', marginBottom: '5px' }}>{p.nome_cliente} ({p.numero_persone} pax)</strong>
                          <div style={{ fontSize: '13px', color: '#666' }}><b>Data Prenotazione:</b> {formatDataOraLeggibile(p.data_ora)}</div>
                          <div style={{ fontSize: '13px', color: '#dc3545' }}><b>Eliminato il:</b> {formatDataOraLeggibile(p.data_eliminazione)}</div>
                       </div>
                       <div style={{ display: 'flex', gap: '10px' }}>
                         <button onClick={() => ripristinaDaCestino(p.id)} style={{ background: '#28a745', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 Ripristina</button>
                         <button onClick={() => eliminaDefinitivamente(p.id)} style={{ background: '#fff0f0', color: '#dc3545', border: '1px solid #dc3545', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✖ Elimina</button>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      )}

      {/* PULSANTONE FLUTTUANTE SOLO SU MOBILE E NON IN FULLSCREEN */}
      {isMobile && nomeCliente && oraEsatta && tavoliSelezionati.length > 0 && !isEditMode && !isFullscreen && (
        <button onClick={salvaPrenotazione} style={{ position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: editingId ? '#ffc107' : '#28a745', color: editingId ? 'black' : 'white', padding: '18px 0', borderRadius: '50px', border: 'none', fontWeight: 'bold', fontSize: '18px', width: '90%', boxShadow: '0 8px 25px rgba(0,0,0,0.3)', cursor: 'pointer' }}>
            {editingId ? "💾 AGGIORNA PRENOTAZIONE" : "💾 CONFERMA PRENOTAZIONE"}
        </button>
      )}
    </div>
  );
}
