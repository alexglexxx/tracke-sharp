import { useState, useEffect } from 'react'

export default function Tracker() {
  const [tab, setTab] = useState('NFL')
  const [filtro, setFiltro] = useState('TODOS')
  const [lastUpdate, setLastUpdate] = useState('')
  const [updating, setUpdating] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)
  const [realData, setRealData] = useState({ 'MLB': [], 'NFL': [] })
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchSharp = async () => {
    if (updating) return
    setUpdating(true)
    setJustUpdated(false)
    setLoading(true)
    try {
      const res = await fetch('/api/check-sharp-mlb')
      const j = await res.json()
      const alerts = j.alerts || []
      const mapped = { 'MLB': [], 'NFL': [] }
      alerts.forEach(a => {
        const league = a.league || 'MLB'
        const key = league === 'MLB'? 'MLB' : 'NFL'
        let tipo = 'VALOR VIE'
        if (key === 'NFL') {
          const pt = Math.abs(a.point || 0)
          if (pt >= 6) tipo = 'EARLY LUN-MAR'
          else if (pt >= 3) tipo = 'VALOR VIE'
          else tipo = 'CONFIRM DOM'
        }
        mapped[key].push({
          partido: a.game,
          pinnacle: a.line,
          publico: a.tickets || (a.isSteam? 'STEAM' : '-'),
          mov: a.tickets && a.money? (a.money - a.tickets) : 0,
          precio: a.price > 0? '+'+a.price : ''+a.price,
          senal: a.isSteam? 'STEAM SHARP' : 'SHARP',
          tipo: tipo,
          team: a.team,
          signalFull: a.signal
        })
      })
      setRealData(mapped)
      localStorage.setItem('sharp_cache', JSON.stringify(mapped))
      localStorage.setItem('sharp_lastUpdate', new Date().toLocaleString())
      setLastUpdate(new Date().toLocaleTimeString())
      setJustUpdated(true)
      setHasLoaded(true)
      setTimeout(()=> setJustUpdated(false), 2500)
    } catch(e) { console.log(e) }
    finally { setUpdating(false); setLoading(false) }
  }

  useEffect(() => {
    const cached = localStorage.getItem('sharp_cache')
    const cachedTime = localStorage.getItem('sharp_lastUpdate')
    if (cached) {
      try {
        // Migración: si el cache viejo tenía Liga MX, lo limpiamos
        const parsed = JSON.parse(cached)
        if (parsed['Liga MX']) delete parsed['Liga MX']
        setRealData(parsed)
        setLastUpdate(cachedTime || '')
        setHasLoaded(true)
      } catch(e){}
    }
  }, [])

  const currentData = realData[tab] || []
  const filtered = currentData.filter(r => {
    if (filtro === 'TODOS') return true
    return r.tipo.includes(filtro.split(' ')[0]) || r.senal.includes(filtro.split(' ')[0])
  })

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'system-ui', padding: '16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>🎯 Tracker Sharp Underdogs</h1>
        <div style={{ background: '#1a1a1a', padding: 12, borderRadius: 12, margin: '12px 0', fontSize: 13, lineHeight: '18px', border: '1px solid #00ff8833' }}>
          <b style={{ color: '#00ff88' }}>💰 Ahorro API: 0 consumo al abrir</b><br/>
          Solo gasta al presionar ACTUALIZAR o crons programados<br/>
          Lun 10am: NFL Early | Vie 5pm: Valor | Dom 10am: Confirm<br/>
          <span style={{ color: '#888' }}>https://tracke-sharp.vercel.app</span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
          <button onClick={fetchSharp} disabled={updating} style={{ background: justUpdated? '#00ff88' : updating? '#333' : '#00ff88', color: 'black', border: 0, padding: '14px 22px', borderRadius: 12, fontWeight: 900, flex: 1, cursor: updating? 'not-allowed' : 'pointer', fontSize: 15 }}>
            {justUpdated? '✅ SHARP ACTUALIZADO' : updating? '⏳ BUSCANDO...' : '🔄 ACTUALIZAR AHORA (gasta 2 créditos)'}
          </button>
          <div style={{ background: '#1a1a1a', padding: '12px 20px', borderRadius: 10, flex: 1, textAlign: 'center', border: justUpdated? '1px solid #00ff88' : '1px solid #333' }}>
            Última: {lastUpdate || 'nunca'}<br/>
            <b style={{ color: hasLoaded? '#00ff88' : '#ffaa00' }}>{hasLoaded? `${filtered.length} SHARP cache` : 'Presiona actualizar'}</b><br/>
            <span style={{ fontSize: 10, color: '#666' }}>{hasLoaded? 'Cache local - 0 créditos' : '0 créditos hasta actualizar'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['MLB', 'NFL'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: 12, borderRadius: 10, border: tab === t? '2px solid #00ff88' : '1px solid #333', background: tab === t? '#00ff8811' : '#1a1a1a', color: 'white', fontWeight: 700 }}>{t}</button>
          ))}
        </div>

        <div style={{ background: '#1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.6fr 0.6fr 0.6fr 1fr', padding: '12px', background: '#222', fontSize: 12, fontWeight: 700, color: '#888' }}>
            <div>Partido (esta jornada)</div><div>Mov. Pinnacle</div><div>% Público</div><div>Mov</div><div>Mejor Precio</div><div>Señal</div>
          </div>
          {loading? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Buscando SHARP real... (2 créditos)</div>
          ) :!hasLoaded? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
              <b>0 créditos consumidos</b><br/>Presiona ACTUALIZAR para buscar SHARP reales<br/>
              <span style={{ fontSize: 11 }}>Ej: Commanders +4 +103 @ Eagles - 84%/59%</span>
            </div>
          ) : filtered.length === 0? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888' }}>
              No hay SHARP para {tab} esta jornada.<br/>Vacio intencional.<br/>
              <span style={{ fontSize: 11 }}>Cache local - 0 créditos</span>
            </div>
          ) : filtered.map((r,i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.6fr 0.6fr 0.6fr 1fr', padding: '12px', borderTop: '1px solid #222', fontSize: 13, alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>{r.partido}<br/><span style={{ fontSize: 11, color: '#00ff88' }}>{r.team}</span><br/><span style={{ fontSize: 10, color: '#666' }}>{r.signalFull}</span></div>
              <div style={{ color: '#aaa', fontSize: 12 }}>{r.pinnacle}</div>
              <div>{typeof r.publico === 'string'? r.publico : r.publico+'%'}</div>
              <div style={{ color: r.mov < 0? '#00ff88' : '#ff5555' }}>{r.mov}</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.precio}</div>
              <div><span style={{ background: '#00ff8822', border: '1px solid #00ff88', color: '#00ff88', padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{r.senal}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
