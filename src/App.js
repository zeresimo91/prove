import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Draggable from 'react-draggable';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

// Controllo critico: se mancano le chiavi, l'app crasha subito
if (!supabaseUrl || !supabaseKey) {
    console.error("MANCANO LE CHIAVI DI SUPABASE! Controlla il tuo file .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- FUNZIONI UTILITY ---
const formatData = (isoString) => { if (!isoString) return ''; const d = new Date(isoString); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatOra = (isoString) => { if (!isoString) return ''; return new Date(isoString).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [loading, setLoading] = useState(true);

  // --- STATI GESTIONALE ---
  const [sale, setSale] = useState([]);
  const [tuttiITavoli, setTuttiITavoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [dataVista, setDataVista] = useState(formatData(new Date().toISOString()));
  const [servizioVista, setServizioVista] = useState(new Date().getHours() < 16 ? 'pranzo' : 'cena');
  const [tavoliSelezionati, setTavoliSelezionati] = useState([]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [numeroPersone, setNumeroPersone] = useState('');
  const [oraEsatta, setOraEsatta] = useState('');

  // --- LOGIN E SESSIONE ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsLoggedIn(true);
      setLoading(false);
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("Tentativo login...");
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.trim(),
      password: passInput.trim(),
    });
    if (error) {
      alert("Errore Login: " + error.message);
    } else {
      setIsLoggedIn(true);
      window.location.reload(); // Forza ricarica per sicurezza
    }
  };

  // --- CARICAMENTO DATI ---
  const aggiornaTutto = async () => {
    const { data: s } = await supabase.from('sale').select('*').order('ordine');
    const { data: t } = await supabase.from('tavoli').select('*');
    const { data: p } = await supabase.from('prenotazioni').select('*').eq('eliminata', false);
    if(s) setSale(s);
    if(t) setTuttiITavoli(t);
    if(p) setPrenotazioni(p);
  };

  useEffect(() => { if (isLoggedIn) aggiornaTutto(); }, [isLoggedIn]);

  // --- INTERFACCIA ---
  if (loading) return <div>Caricamento...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
       {!isLoggedIn ? (
          <div style={{ maxWidth: '300px', margin: 'auto' }}>
            <form onSubmit={handleLogin}>
              <h2>Login</h2>
              <input type="email" placeholder="Email" onChange={e => setEmailInput(e.target.value)} required style={{width: '100%', marginBottom: '10px'}} />
              <input type="password" placeholder="Password" onChange={e => setPassInput(e.target.value)} required style={{width: '100%', marginBottom: '10px'}} />
              <button type="submit" style={{width: '100%'}}>ACCEDI</button>
            </form>
          </div>
       ) : (
          <div>
            <h1>Gestionale Belvedere</h1>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>Logout</button>
            
            {/* ESEMPIO SEMPLICE DI TABELLA TAVOLI */}
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                {tuttiITavoli.map(t => (
                    <div key={t.id} style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '5px' }}>
                        Tavolo {t.numero_tavolo}
                    </div>
                ))}
            </div>
          </div>
       )}
    </div>
  );
}
