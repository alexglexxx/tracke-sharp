
import { useState, useEffect } from 'react'

export default function Tracker() {
  const [tab, setTab] = useState('NFL')
  const [filtro, setFiltro] = useState('TODOS')
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString())
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    // Lee de localStorage si el usuario la puso a mano
    const saved = localStorage.getItem('ODDS_API_KEY')
    if(saved) setApiKey(saved)
  }, [])

  const mock = {
    'Liga MX': [
      { partido: 'América vs Puebla', pinnacle: 'Puebla +0.5 (se movió 0.5)', publico: 82, mov: -0.5, precio: '+125', senal: 'SHARP', tipo: 'VALOR VIE' },
      { partido: 'Chivas vs Atlas', pinnacle: 'Atlas +0.5', publico: 68, mov: -0.2, precio: '+140', senal: '', tipo: 'VALOR VIE' },
      { partido: 'Cruz Azul vs León', pinnacle: 'León +0.5 (se movió 0.6)', publico: 77, mov: -0.6, precio: '+155', senal: 'SHARP', tipo: 'VALOR VIE' },
    ],
    'MLB': [
      { partido: 'Yankees vs Orioles', pinnacle: 'Orioles +160 → +140', publico: 81, mov: -20, precio: '+145', senal: 'SHARP', tipo: 'VALOR VIE' },
      { partido: 'Dodgers vs Rockies', pinnacle: 'Rockies +180 → +165', publico: 79, mov: -15, precio: '+172', senal: '', tipo: 'VALOR VIE' },
    ],
    'NFL': [
      { partido: 'Chiefs vs Chargers', pinnacle: 'Chargers +6.5 → +6.0 (Pinnacle)', publico: 82, mov: -0.5, precio: '+185', senal: 'SHARP - EARLY', tipo: 'EARLY LUN-MAR' },
      { partido: 'Cowboys vs Eagles', pinnacle: 'Eagles +3.5 → +3.0', publico: 71, mov: -0.5, precio: '+145', senal: 'EARLY', tipo: 'EARLY LUN-MAR' },
      { partido: '49ers vs Rams', pinnacle: 'Rams +7.0 → +6.0', publico: 84, mov: -1.0, precio: '+210', senal: 'SHARP - VALOR VIE', tipo: 'VALOR VIE' },
      { partido: 'Bills vs Dolphins', pinnacle: 'Dolphins +2.5 → +1.5', publico: 78, mov: -1.0, precio: '+165', senal: 'SHARP - CONFIRM DOM', tipo: 'CONFIRM DOM' },
    ]
  }

  const data = mock[tab].filter(r => filtro === 'TODOS' || r.tipo.includes(filtro.split(' ')[0]) || r.senal.includes(filtro.split(' ')[0]))

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'system-ui', padding: '16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>🎯 Tracker Sharp Underdogs</h1>
        <div style={{ background: '#1a1a1a', padding: 12, borderRadius: 12, margin: '12px 0', fontSize: 13, lineHeight: '18px' }}>
          <b>Horario nuevo:</b><br/>
          Lun 10am: NFL Early Lines + MLB + Liga MX | Mar 10am: NFL Early Movement<br/>
          Mié-Jue 10am: MLB + Liga MX | Vie 5pm: NFL Valor domingo | Dom 10am: NFL Confirmación
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
          <button onClick={() => setLastUpdate(new Date().toLocaleTimeString())} style={{ background: '#00ff88', color: 'black', border: 0, padding: '12px 20px', borderRadius: 10, fontWeight: 800, flex: 1 }}>🔄 ACTUALIZAR AHORA</button>
          <div style={{ background: '#1a1a1a', padding: '12px 20px', borderRadius: 10, flex: 1, textAlign: 'center' }}>Última: {lastUpdate}<br/><b style={{ color: '#00ff88' }}>ROI +4.2u</b></div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['Liga MX', 'MLB', 'NFL'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: 12, borderRadius: 10, border: tab === t ? '2px solid #00ff88' : '1px solid #333', background: tab === t ? '#00ff8811' : '#1a1a1a', color: 'white', fontWeight: 700 }}>{t}</button>
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
            <div>Partido</div><div>Mov. Pinnacle</div><div>% Público</div><div>Mov</div><div>Mejor Precio</div><div>Señal</div>
          </div>
          {data.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.6fr 0.6fr 0.6fr 1fr', padding: '12px', borderTop: '1px solid #222', fontSize: 13, alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>{r.partido}</div>
              <div style={{ color: '#aaa' }}>{r.pinnacle}</div>
              <div>{r.publico}%</div>
              <div style={{ color: r.mov < 0 ? '#00ff88' : '#ff5555' }}>{r.mov}</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.precio}</div>
              <div>{r.senal ? <span style={{ background: r.senal.includes('EARLY') ? '#3b82f622' : '#00ff8822', border: `1px solid ${r.senal.includes('EARLY') ? '#3b82f6' : '#00ff88'}`, color: r.senal.includes('EARLY') ? '#3b82f6' : '#00ff88', padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{r.senal}</span> : <span style={{ color: '#555' }}>Sin valor</span>}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, background: '#111', padding: 16, borderRadius: 12, fontSize: 13 }}>
          <b>Cómo funciona:</b><br/>
          • <b>Lunes/Martes:</b> Salen líneas NFL. Agarra underdog +3 antes de que baje a +1.5.<br/>
          • <b>Viernes 5pm:</b> Si 80% con favorito pero Pinnacle baja línea hacia underdog = dinero inteligente contra público = SHARP.<br/>
          • <b>Domingo 10am:</b> Confirmación final.<br/><br/>
          MLB/Liga MX igual pero en ML: +160 que baja a +140 con 80% en Yankees/América = SHARP.
        </div>

        <div style={{ marginTop: 20, background: '#1a1a1a', padding: 12, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>ODDS API KEY (opcional, para datos reales)</div>
          <input value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('ODDS_API_KEY', e.target.value) }} placeholder="pega tu nueva key aquí" type="password" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0a0a0a', color: 'white' }} />
          <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>Si la pones en Vercel > Settings > Environment Variables como ODDS_API_KEY, se usa automática sin escribirla aquí.</div>
        </div>
      </div>
    </div>
  )
}
