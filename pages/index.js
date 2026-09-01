import { useState, useEffect } from 'react'

export default function Tracker() {
  const [tab, setTab] = useState('MLB')
  const [lastUpdate, setLastUpdate] = useState('')
  const [updating, setUpdating] = useState(false)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSharpOnly = async () => {
    setUpdating(true)
    setLoading(true)
    try {
      // SOLO SHARP - mismo que Telegram
      const endpoint = tab === 'NFL' ? '/api/check-sharp-nfl' : '/api/check-sharp-mlb'
      let res = await fetch(endpoint)
      let j = await res.json()
      // fallback si no existe nfl endpoint
      if (!j.alerts && tab === 'NFL') {
        res = await fetch('/api/public-betting?league=nfl')
        j = await res.json()
        // solo si tiene divergence
        const sharpOnly = (j.games || []).filter(g => g.divergence)
        setGames(sharpOnly.map(g => ({
          partido: g.matchup,
          sharpTeam: g.sharpSide || g.away,
          pinnacle: g.away + ' ' + (g.price || '') + ' -> SHARP',
          publico: g.publicTickets,
          dinero: g.publicMoney,
          precio: g.price || (g.publicTickets ? g.publicTickets + '%' : ''),
          senal: 'SHARP',
          signalFull: g.signal
        })))
      } else {
        const alerts = j.alerts || j.games || []
        // alerts de check-sharp-mlb tiene formato {game, team, price, tickets, money, signal, line}
        const mapped = alerts.filter(a => a.divergence !== false).map(a => ({
          partido: a.game || a.matchup,
          sharpTeam: a.team || a.sharpSide || a.away,
          pinnacle: a.line || (a.team + ' ' + (a.price > 0 ? '+'+a.price : a.price) + ' ML'),
          publico: a.tickets || a.publicTickets,
          dinero: a.money || a.publicMoney,
          precio: a.price ? (a.price > 0 ? '+'+a.price : a.price) : (a.publicTickets ? a.publicTickets + '%' : ''),
          senal: 'SHARP',
          signalFull: a.signal || `SHARP - ${a.tickets}% tickets / ${a.money}% dinero`
        }))
        setGames(mapped)
      }
      setLastUpdate(new Date().toLocaleTimeString())
    } catch(e) {
      console.log(e)
      setGames([])
    } finally {
      setUpdating(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSharpOnly()
  }, [tab])

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'system-ui', padding: '16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>🎯 Tracker SHARP ONLY</h1>
        <div style={{ background: '#1a1a1a', padding: 12, borderRadius: 12, margin: '12px 0', fontSize: 13 }}>
          <b>Solo apuestas con valor SHARP.</b> Si no hay divergencia, vacio. Mismo que Telegram.<br/>
          Horario: Lun 10am: NFL Early | Vie 5pm: NFL Valor | Dom 10am: NFL Confirm | Diario: MLB
        </div>

        <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
          <button onClick={fetchSharpOnly} disabled={updating} style={{ background: '#00ff88', color: 'black', border: 0, padding: '12px 20px', borderRadius: 10, fontWeight: 800, flex: 1 }}>
            {updating ? 'BUSCANDO SHARP...' : '🔄 ACTUALIZAR SHARP'}
          </button>
          <div style={{ background: '#1a1a1a', padding: '12px 20px', borderRadius: 10, flex: 1, textAlign: 'center' }}>
            Ultima: {lastUpdate || '--:--'}<br/><b style={{ color: '#00ff88' }}>{games.length} SHARP hoy</b>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['MLB','NFL','Liga MX'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: 12, borderRadius: 10, border: tab === t ? '2px solid #00ff88' : '1px solid #333', background: tab === t ? '#00ff8811' : '#1a1a1a', color: 'white', fontWeight: 700 }}>{t}</button>
          ))}
        </div>

        <div style={{ background: '#1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.7fr 0.7fr 0.8fr 0.8fr', padding: '12px', background: '#222', fontSize: 12, fontWeight: 700, color: '#888' }}>
            <div>Partido SHARP</div><div>Mov. Pinnacle</div><div>% Tickets</div><div>% Dinero</div><div>Mejor Precio</div><div>Senal</div>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Buscando SHARP hoy...</div>
          ) : games.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888' }}>
              No hay SHARP hoy para {tab}.<br/>Vacio intencional - sin valor no se muestra nada.<br/>
              <span style={{ fontSize: 11 }}>Si hay divergencia 80% tickets / 50% dinero, aparece aqui y en Telegram.</span>
            </div>
          ) : games.map((r,i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.7fr 0.7fr 0.8fr 0.8fr', padding: '14px 12px', borderTop: '1px solid #222', fontSize: 13, alignItems: 'center' }}>
              <div><b>{r.partido}</b><br/><span style={{ fontSize: 10, color: '#00ff88' }}>{r.signalFull}</span><br/><span style={{ fontSize: 11, color: '#aaa' }}>Apuesta: {r.sharpTeam}</span></div>
              <div style={{ color: '#aaa' }}>{r.pinnacle}</div>
              <div style={{ color: '#ff5555', fontWeight: 700 }}>{r.publico}%</div>
              <div style={{ color: '#00ff88', fontWeight: 700 }}>{r.dinero}%</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#fff' }}>{r.precio}</div>
              <div><span style={{ background: '#00ff8822', border: '1px solid #00ff88', color: '#00ff88', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 900 }}>SHARP</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
