import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Draggable from 'react-draggable';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const [loading, setLoading] = useState(true); // AGGIUNTO STATO LOADING
  const [sale, setSale] = useState([]);
  const [tuttiITavoli, setTuttiITavoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  // ... (tutti gli altri stati rimangono uguali)
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [ultime10, setUltime10] = useState([]);
  const [showUltime10, setShowUltime10] = useState(false);

  // --- LOGICA DI CARICAMENTO SICURA ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true);
        aggiornaTutto();
      }
      setLoading(false);
    });
  }, []);

  const aggiornaTutto = async () => {
    try {
      const [saleRes, tavoliRes, prenoRes] = await Promise.all([
        supabase.from('sale').select('*').order('ordine'),
        supabase.from('tavoli').select('*'),
        supabase.from('prenotazioni').select('*').eq('eliminata', false)
      ]);
      if (saleRes.data) setSale(saleRes.data);
      if (tavoliRes.data) setTuttiITavoli(tavoliRes.data);
      if (prenoRes.data) setPrenotazioni(prenoRes.data);
    } catch (e) { console.error("Errore caricamento:", e); }
  };

  // --- SICUREZZA RENDER ---
  if (loading) return <div style={{padding: '20px'}}>Caricamento in corso...</div>;

  if (!isLoggedIn) {
    return (
        <form onSubmit={async (e) => { 
            e.preventDefault(); 
            const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passInput });
            if (error) alert("Login errato!"); else aggiornaTutto();
        }} style={{ maxWidth: '300px', margin: '100px auto', padding: '20px', border: '1px solid #ccc' }}>
            <h2>Login</h2>
            <input type="email" placeholder="Email" onChange={e => setEmailInput(e.target.value)} required style={{width:'100%'}} />
            <input type="password" placeholder="Password" onChange={e => setPassInput(e.target.value)} required style={{width:'100%'}} />
            <button type="submit" style={{width:'100%', marginTop:'10px'}}>Accedi</button>
        </form>
    );
  }

  // --- RENDER PRINCIPALE CON CONTROLLO DATI ---
  return (
    <div style={{ padding: '20px' }}>
        <header>
            <button onClick={async () => {
                const { data } = await supabase.from('prenotazioni').select('*').eq('eliminata', false).order('created_at', { ascending: false }).limit(10);
                setUltime10(data || []);
                setShowUltime10(true);
            }}>🕒 Ultime 10</button>
            <button onClick={() => supabase.auth.signOut()}>Logout</button>
        </header>

        {/* CONTROLLO SICUREZZA: Se tavoli è vuoto, non crashare */}
        {tuttiITavoli.length === 0 ? (
            <p>Nessun tavolo configurato.</p>
        ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                {tuttiITavoli.map(t => {
                    const pres = prenotazioni.filter(p => p.tavoli_assegnati && p.tavoli_assegnati.includes(t.id));
                    let bg = pres.length >= 2 ? '#dc3545' : (pres.length === 1 ? '#fd7e14' : 'white');
                    return (
                        <div key={t.id} style={{ background: bg, border: '1px solid #ccc', padding: '10px' }}>
                            Tavolo {t.numero_tavolo}
                        </div>
                    );
                })}
            </div>
        )}

        {/* POPUP ULTIME 10 */}
        {showUltime10 && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', padding: '50px' }} onClick={() => setShowUltime10(false)}>
                <div style={{ background: 'white', padding: '20px', maxWidth: '400px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
                    <h3>Ultime 10</h3>
                    {ultime10.map(p => <div key={p.id}>{p.nome_cliente}</div>)}
                </div>
            </div>
        )}
    </div>
  );
}
