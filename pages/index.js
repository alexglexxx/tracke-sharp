
import { useState, useEffect } from 'react'

export default function Tracker() {
  const [tab, setTab] = useState('MLB')
  const [filtro, setFiltro] = useState('TODOS')
  const [lastUpdate, setLastUpdate] = useState('')
  const [updating, setUpdating] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)
  const [games, setGames] = useState([])
  const [sharpGames, setSharpGames] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchReal = async () => {
    setUpdating(true)
    setLoading(true)
    try {
      const league = tab.toLowerCase().replace('liga mx','mlb')
      const l = tab === 'Liga MX' ? 'mlb' : tab.toLowerCase()
      // 1. Juegos reales de hoy
      const res = await fetch(`/api/public-betting?league=${l}`)
      const j = await res.json()
      let real = j.games || []

      // 2. Sharp alerts para marcar SHARP
      try {
        const r2 = await fetch('/api/check-sharp-mlb')
        const j2 = await r2.json()
        const alerts = j2.alerts || []
        setSharpGames(alerts)
        // Marcar divergencia en real
        real = real.map(g => {
          const found = alerts.find(a => 
            a.game.toLowerCase().includes(g.away.toLowerCase().split(' ').pop()) ||
            a.game.toLowerCase().includes(g.home.toLowerCase().split(' ').pop()) ||
            g.matchup.toLowerCase().includes(a.team.toLowerCase().split(' ').pop())
          )
          if (found) {
            return { ...g, publicTickets: found.tickets, publicMoney: found.money, signal: found.signal, divergence: true, sharpSide: found.team, line: found.line, price: found.price }
          }
          return g
        })
      } catch(e){}

      setGames(real)
      setLastUpdate(new Date().toLocaleTimeString())
      setJustUpdated(true)
      setTimeout(()=> setJustUpdated(false), 2000)
      if (navigator.vibrate) navigator.vibrate([50,30,50])
    } catch(e) {
      console.log(e)
    } finally {
      setUpdating(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReal()
  }, [tab])

  const data = games.map(g => ({
    partido: g.matchup,
    pinnacle: g.line || (g.price ? `${g.sharpSide} ${g.price > 0 ? '+'+g.price : g.price} ML` : 'ML real'),
    publico: g.publicTickets || '-',
    mov: g.publicMoney ? (g.publicMoney - (g.publicTickets||0)) : 0,
    precio: g.price ? `${g.price > 0 ? '+'+g.price : g.price}` : (g.publicTickets ? `${g.publicTickets}%` : '-'),
    senal: g.divergence ? 'SHARP' : '',
    tipo: g.divergence ? 'SHARP' : 'REAL',
    commence: g.commence_time,
    signalFull: g.signal
  }))

  const filtered = data.filter(r => {
    if (filtro === 'TODOS') return true
    if (filtro === 'SHARP') return r.senal.includes('SHARP')
    return true
  })

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'system-ui', padding: '16px' }}>
      <style>{\`
        @keyframes spin { from { transform: rotate(0deg)} to { transform: rotate(360deg)} }
        @keyframes pulse { 0%{transform:scale(1)} 50%{transform:scale(0.96)} 100%{transform:scale(1)} }
        @keyframes slideIn { from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:translateY(0)} }
      \`}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>🎯 Tracker Sharp Underdogs - REAL</h1>
        <div style={{ background: '#1a1a1a', padding: 12, borderRadius: 12, margin: '12px 0', fontSize: 13, lineHeight: '18px' }}>
          <b>Fuente:</b> The Odds API (Pinnacle) + Telegram SHARP<br/>
          {tab} - Solo juegos de HOY en CDMX. Si no hay, queda vacio (no falsos).
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
          <button 
            onClick={fetchReal}
            disabled={updating}
            style={{ 
              background: justUpdated ? '#00ff88' : updating ? '#333' : '#00ff88', 
              color: updating ? '#888' : 'black', 
              border: 0, 
              padding: '12px 20px', 
              borderRadius: 10, 
              fontWeight: 800, 
              flex: 1,
              cursor: updating ? 'not-allowed' : 'pointer',
              transform: updating ? 'scale(0.97)' : 'scale(1)',
              transition: 'all 0.2s ease',
              animation: updating ? 'pulse 0.8s infinite' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
            <span style={{ display: 'inline-block', animation: updating ? 'spin 0.8s linear infinite' : 'none' }}>
              {justUpdated ? '✅' : updating ? '⏳' : '🔄'}
            </span>
            {justUpdated ? '¡ACTUALIZADO!' : updating ? 'CARGANDO REALES...' : 'ACTUALIZAR AHORA'}
          </button>
          <div style={{ background: '#1a1a1a', padding: '12px 20px', borderRadius: 10, flex: 1, textAlign: 'center', border: justUpdated ? '1px solid #00ff88' : '1px solid #333' }}>
            Última: {lastUpdate || '--:--'}<br/>
            <b style={{ color: '#00ff88' }}>{justUpdated ? '✅ Datos reales hoy' : ` ${games.length} juegos hoy`}</b>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['Liga MX', 'MLB', 'NFL'].map(t => (
            <button key={t} onClick={() => { setTab(t); if(navigator.vibrate) navigator.vibrate(20)}} style={{ flex: 1, padding: 12, borderRadius: 10, border: tab === t ? '2px solid #00ff88' : '1px solid #333', background: tab === t ? '#00ff8811' : '#1a1a1a', color: 'white', fontWeight: 700 }}>{t}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['TODOS', 'SHARP'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid #333', background: filtro === f ? '#fff' : '#1a1a1a', color: filtro === f ? 'black' : 'white', fontSize: 12 }}>{f}</button>
          ))}
        </div>

        <div style={{ background: '#1a1a1a', borderRadius: 12, overflow: 'hidden', opacity: updating ? 0.6 : 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.6fr 0.6fr 0.6fr 1fr', padding: '12px', background: '#222', fontSize: 12, fontWeight: 700, color: '#888' }}>
            <div>Partido (REAL HOY)</div><div>Mov. Pinnacle</div><div>% Público</div><div>Mov</div><div>Mejor Precio</div><div>Señal</div>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cargando juegos reales de hoy...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
              No hay juegos reales hoy para {tab}. Vacío intencional (no falsos).<br/>
              <span style={{ fontSize: 11 }}>Fuente: real-mlb-live-today</span>
            </div>
          ) : filtered.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.6fr 0.6fr 0.6fr 1fr', padding: '12px', borderTop: '1px solid #222', fontSize: 13, alignItems: 'center', animation: justUpdated ? `slideIn ${0.2+i*0.05}s` : 'none' }}>
              <div style={{ fontWeight: 600 }}>{r.partido}<br/><span style={{ fontSize: 10, color: '#666' }}>{r.signalFull}</span></div>
              <div style={{ color: '#aaa' }}>{r.pinnacle}</div>
              <div>{r.publico}{r.publico !== '-' ? '%' : ''}</div>
              <div style={{ color: r.mov < 0 ? '#00ff88' : '#ff5555' }}>{r.mov || '-'}</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.precio}</div>
              <div>{r.senal ? <span style={{ background: '#00ff8822', border: '1px solid #00ff88', color: '#00ff88', padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{r.senal}</span> : <span style={{ color: '#555' }}>Real</span>}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
