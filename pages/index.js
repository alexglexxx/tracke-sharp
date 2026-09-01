import { useState, useEffect } from 'react'

export default function Tracker() {
  const [tab, setTab] = useState('NFL')
  const [filtro, setFiltro] = useState('TODOS')
  const [lastUpdate, setLastUpdate] = useState('')
  const [updating, setUpdating] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)
  const [realData, setRealData] = useState({ 'Liga MX': [], 'MLB': [], 'NFL': [] })
  const [loading, setLoading] = useState(true)

  const fetchSharp = async () => {
    if (updating) return
    setUpdating(true)
    setJustUpdated(false)
    setLoading(true)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
    try {
      const res = await fetch('/api/check-sharp-mlb')
      const j = await res.json()
      const alerts = j.alerts || []

      const mapped = {
        'Liga MX': [],
        'MLB': [],
        'NFL': []
      }

      // Mapear alerts reales a formato de tabla
      alerts.forEach(a => {
        const league = a.league || 'MLB'
        const key = league === 'MLB' ? 'MLB' : league === 'NFL' ? 'NFL' : 'Liga MX'
        // Determinar tipo para NFL: EARLY, VALOR VIE, CONFIRM DOM segun linea
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
          publico: a.tickets,
          mov: (a.money || 0) - (a.tickets || 0),
          precio: a.price > 0 ? '+'+a.price : ''+a.price,
          senal: 'SHARP',
          tipo: tipo,
          team: a.team
        })
      })

      // Si no hay NFL aun (lunes es cuando salen), mostrar vacio intencional - no falsos
      setRealData(mapped)
      setLastUpdate(new Date().toLocaleTimeString())
      setJustUpdated(true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50,30,50])
      setTimeout(()=> setJustUpdated(false), 2000)
    } catch(e) {
      console.log(e)
    } finally {
      setUpdating(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSharp()
  }, [])

  const currentData = realData[tab] || []
  const filtered = currentData.filter(r => {
    if (filtro === 'TODOS') return true
    return r.tipo.includes(filtro.split(' ')[0]) || r.senal.includes(filtro.split(' ')[0])
  })

  const jornadaLabel = tab === 'NFL' ? 'esta jornada' : tab === 'MLB' ? 'esta jornada' : 'esta jornada'

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'system-ui', padding: '16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>🎯 Tracker Sharp Underdogs</h1>
        <div style={{ background: '#1a1a1a', padding: 12, borderRadius: 12, margin: '12px 0', fontSize: 13, lineHeight: '18px' }}>
          <b>Horario:</b><br/>
          Lun 10am: NFL Early Lines + MLB + Liga MX | Mar 10am: NFL Early Movement<br/>
          Mié-Jue 10am: MLB + Liga MX | Vie 5pm: NFL Valor domingo | Dom 10am: NFL Confirmación<br/>
          <span style={{ color: '#00ff88' }}>Solo SHARP - {jornadaLabel}. Si no hay valor, vacio (no falsos).</span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
          <button onClick={fetchSharp} disabled={updating} style={{ background: justUpdated ? '#00ff88' : updating ? '#333' : '#00ff88', color: justUpdated ? 'black' : updating ? '#888' : 'black', border: 0, padding: '12px 20px', borderRadius: 10, fontWeight: 800, flex: 1, cursor: updating ? 'not-allowed' : 'pointer' }}>
            {justUpdated ? '✅' : updating ? '⏳' : '🔄'} {justUpdated ? 'SHARP ACTUALIZADO!' : updating ? 'BUSCANDO SHARP...' : 'ACTUALIZAR AHORA'}
          </button>
          <div style={{ background: '#1a1a1a', padding: '12px 20px', borderRadius: 10, flex: 1, textAlign: 'center', border: justUpdated ? '1px solid #00ff88' : '1px solid #333' }}>
            Última: {lastUpdate || '--:--'}<br/><b style={{ color: '#00ff88' }}>{justUpdated ? '✅ SHARP fresco' : `${filtered.length} SHARP ${jornadaLabel}`}</b>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['Liga MX', 'MLB', 'NFL'].map(t => (
            <button key={t} onClick={() => { setTab(t); setFiltro('TODOS') }} style={{ flex: 1, padding: 12, borderRadius: 10, border: tab === t ? '2px solid #00ff88' : '1px solid #333', background: tab === t ? '#00ff8811' : '#1a1a1a', color: 'white', fontWeight: 700 }}>{t}</button>
          ))}
        </div>

        {tab === 'NFL' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {['TODOS', 'EARLY LUN-MAR', 'VALOR VIE', 'CONFIRM DOM'].map(f => (
              <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid #333', background: filtro === f ? '#fff' : '#1a1a1a', color: filtro === f ? 'black' : 'white', fontSize: 12 }}>{f}</button>
            ))}
          </div>
        )}

        <div style={{ background: '#1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.6fr 0.6fr 0.6fr 1fr', padding: '12px', background: '#222', fontSize: 12, fontWeight: 700, color: '#888' }}>
            <div>Partido ({jornadaLabel})</div><div>Mov. Pinnacle</div><div>% Público</div><div>Mov</div><div>Mejor Precio</div><div>Señal</div>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Buscando SHARP de {jornadaLabel}...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888' }}>
              No hay SHARP para {tab} {jornadaLabel}.<br/>Vacio intencional (no falsos).<br/>
              <span style={{ fontSize: 11 }}>Aparece solo si hay divergencia 78% tickets vs 50% dinero.</span>
            </div>
          ) : filtered.map((r,i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.6fr 0.6fr 0.6fr 1fr', padding: '12px', borderTop: '1px solid #222', fontSize: 13, alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>{r.partido}<br/><span style={{ fontSize: 11, color: '#00ff88' }}>{r.team}</span></div>
              <div style={{ color: '#aaa' }}>{r.pinnacle}</div>
              <div>{r.publico}%</div>
              <div style={{ color: r.mov < 0 ? '#00ff88' : '#ff5555' }}>{r.mov}</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.precio}</div>
              <div>{r.senal ? <span style={{ background: r.senal.includes('EARLY') ? '#3b82f622' : '#00ff8822', border: `1px solid ${r.senal.includes('EARLY') ? '#3b82f6' : '#00ff88'}`, color: r.senal.includes('EARLY') ? '#3b82f6' : '#00ff88', padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{r.senal} {r.tipo !== 'VALOR VIE' && tab==='NFL' ? '- '+r.tipo.split(' ')[0] : ''}</span> : <span style={{ color: '#555' }}>Sin valor</span>}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, background: '#111', padding: 16, borderRadius: 12, fontSize: 13 }}>
          <b>Cómo funciona:</b><br/>
          • <b>Lunes/Martes:</b> Salen líneas NFL. Agarra underdog +3 antes de que baje a +1.5 = EARLY.<br/>
          • <b>Viernes 5pm:</b> Si 80% con favorito pero Pinnacle baja línea hacia underdog = VALOR VIE.<br/>
          • <b>Domingo 10am:</b> Confirmación final = CONFIRM DOM.<br/><br/>
          MLB igual pero en ML: +160 que baja a +140 con 80% en Yankees = SHARP de esta jornada.
        </div>
      </div>
    </div>
  )
}
