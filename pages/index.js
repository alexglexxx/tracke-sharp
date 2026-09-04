import { useEffect, useMemo, useState } from 'react'

const EMPTY_DATA = {
  MLB: [],
  NFL: [],
}

function formatLastUpdate(value) {
  if (!value) {
    return ''
  }

  return value
}

export default function Tracker() {
  const [tab, setTab] = useState('NFL')
  const [filtro, setFiltro] = useState('TODOS')
  const [lastUpdate, setLastUpdate] = useState('')
  const [updating, setUpdating] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)
  const [realData, setRealData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState('')

  const fetchSharp = async () => {
    if (updating) {
      return
    }

    setUpdating(true)
    setJustUpdated(false)
    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        '/api/check-sharp-mlb',
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      )

      const json = await response.json()

      if (!response.ok || !json.ok) {
        throw new Error(
          json.error ||
            'No fue posible actualizar Tracke Sharp.'
        )
      }

      const mapped = {
        MLB: [],
        NFL: [],
      }

      for (const alert of json.alerts || []) {
        const league =
          alert.league === 'MLB'
            ? 'MLB'
            : 'NFL'

        let tipo = 'VALOR'

        if (league === 'NFL') {
          const point = Math.abs(
            Number(alert.point) || 0
          )

          if (point >= 6) {
            tipo = 'EARLY'
          } else if (point >= 3) {
            tipo = 'VALOR'
          } else {
            tipo = 'CONFIRM'
          }
        }

        const isSteam =
          alert.type === 'STEAM' ||
          alert.isSteam === true

        let publico = 'N/D'
        let publicoFull = 'Datos públicos no disponibles'
        let mov = 'N/D'
        let movNum = 0

        if (
          Number.isFinite(alert.tickets) &&
          Number.isFinite(alert.money)
        ) {
          publico = `${alert.tickets}%`

          publicoFull =
            `${alert.tickets}% tickets / ` +
            `${alert.money}% dinero`

          movNum =
            Number(alert.divergence) || 0

          mov =
            `${movNum >= 0 ? '+' : ''}${movNum}`
        }

        if (isSteam) {
          publico = 'STEAM'
          publicoFull =
            'Comparación Pinnacle vs DraftKings'

          if (
            Number.isFinite(alert.dkPoint) &&
            Number.isFinite(alert.point) &&
            alert.dkPoint !== alert.point
          ) {
            const diff =
              Number(alert.dkPoint) -
              Number(alert.point)

            movNum = -diff

            mov =
              `${diff > 0 ? '-' : '+'}${Math.abs(
                diff
              ).toFixed(1)}`
          } else if (
            Number.isFinite(alert.dkPrice) &&
            Number.isFinite(alert.price)
          ) {
            const diff =
              Number(alert.dkPrice) -
              Number(alert.price)

            movNum = -diff

            mov =
              `${diff > 0 ? '-' : '+'}${Math.abs(
                diff
              )}c`
          }
        }

        mapped[league].push({
          partido: alert.game,
          pinnacle: alert.line,
          publico,
          publicoFull,
          mov,
          movNum,
          precio:
            Number(alert.price) > 0
              ? `+${alert.price}`
              : `${alert.price}`,
          senal: isSteam
            ? 'STEAM'
            : 'SHARP',
          tipo,
          team: alert.team,
          signalFull:
            alert.signal || 'Señal detectada',
          reason:
            alert.reason || '',
        })
      }

      setRealData(mapped)

      const now = new Date()

      const lastUpdateValue =
        now.toLocaleString()

      localStorage.setItem(
        'sharp_cache',
        JSON.stringify(mapped)
      )

      localStorage.setItem(
        'sharp_lastUpdate',
        lastUpdateValue
      )

      setLastUpdate(
        formatLastUpdate(
          now.toLocaleTimeString()
        )
      )

      setJustUpdated(true)
      setHasLoaded(true)

      setTimeout(() => {
        setJustUpdated(false)
      }, 2500)
    } catch (error) {
      console.error(
        'Tracker update error:',
        error
      )

      setError(
        error.message ||
          'Error actualizando datos.'
      )
    } finally {
      setUpdating(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    const cached =
      localStorage.getItem(
        'sharp_cache'
      )

    const cachedTime =
      localStorage.getItem(
        'sharp_lastUpdate'
      )

    if (!cached) {
      return
    }

    try {
      const parsed = JSON.parse(cached)

      setRealData({
        MLB: Array.isArray(parsed.MLB)
          ? parsed.MLB
          : [],
        NFL: Array.isArray(parsed.NFL)
          ? parsed.NFL
          : [],
      })

      setLastUpdate(
        cachedTime || ''
      )

      setHasLoaded(true)
    } catch (error) {
      console.error(
        'Cache parse error:',
        error
      )

      localStorage.removeItem(
        'sharp_cache'
      )

      localStorage.removeItem(
        'sharp_lastUpdate'
      )
    }
  }, [])

  const currentData =
    realData[tab] || []

  const filtered = useMemo(() => {
    return currentData.filter(
      (row) => {
        if (filtro === 'TODOS') {
          return true
        }

        const filterWord =
          filtro
            .split(' ')[0]
            .toUpperCase()

        return (
          row.tipo
            .toUpperCase()
            .includes(filterWord) ||
          row.senal
            .toUpperCase()
            .includes(filterWord)
        )
      }
    )
  }, [currentData, filtro])

  return (
    <div
      style={{
        background: '#0a0a0a',
        minHeight: '100vh',
        color: 'white',
        fontFamily: 'system-ui',
        padding: '16px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          🎯 Tracker Sharp Underdogs
        </h1>

        <div
          style={{
            background: '#1a1a1a',
            padding: 12,
            borderRadius: 12,
            margin: '12px 0',
            fontSize: 13,
            lineHeight: '18px',
            border:
              '1px solid #00ff8833',
          }}
        >
          <b
            style={{
              color: '#00ff88',
            }}
          >
            💰 0 consumo al abrir
          </b>
          <br />

          Solo gasta al presionar
          ACTUALIZAR

          <br />

          <span
            style={{
              color: '#888',
            }}
          >
            https://tracke-sharp.vercel.app
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            margin: '16px 0',
          }}
        >
          <button
            onClick={fetchSharp}
            disabled={updating}
            style={{
              background:
                justUpdated
                  ? '#00ff88'
                  : updating
                    ? '#333'
                    : '#00ff88',
              color: 'black',
              border: 0,
              padding: '14px 22px',
              borderRadius: 12,
              fontWeight: 900,
              flex: 1,
              cursor: updating
                ? 'not-allowed'
                : 'pointer',
              fontSize: 15,
            }}
          >
            {justUpdated
              ? '✅ ACTUALIZADO'
              : updating
                ? '⏳ BUSCANDO...'
                : '🔄 ACTUALIZAR AHORA'}
          </button>

          <div
            style={{
              background: '#1a1a1a',
              padding: '12px 20px',
              borderRadius: 10,
              flex: 1,
              textAlign: 'center',
              border: justUpdated
                ? '1px solid #00ff88'
                : '1px solid #333',
            }}
          >
            Última:{' '}
            {lastUpdate || 'nunca'}
            <br />

            <b
              style={{
                color: hasLoaded
                  ? '#00ff88'
                  : '#ffaa00',
              }}
            >
              {hasLoaded
                ? `${filtered.length} SHARP`
                : 'Presiona actualizar'}
            </b>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#2a1010',
              border:
                '1px solid #ff5555',
              color: '#ff8888',
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {['MLB', 'NFL'].map(
            (league) => (
              <button
                key={league}
                onClick={() =>
                  setTab(league)
                }
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  border:
                    tab === league
                      ? '2px solid #00ff88'
                      : '1px solid #333',
                  background:
                    tab === league
                      ? '#00ff8811'
                      : '#1a1a1a',
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                {league}
              </button>
            )
          )}
        </div>

        <div
          style={{
            background: '#1a1a1a',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '2fr 1.5fr 0.8fr 0.6fr 0.6fr 1fr',
              padding: '12px',
              background: '#222',
              fontSize: 12,
              fontWeight: 700,
              color: '#888',
            }}
          >
            <div>Partido</div>
            <div>Mov. Pinnacle</div>
            <div>% Público</div>
            <div>Mov</div>
            <div>Precio</div>
            <div>Señal</div>
          </div>

          {loading ? (
            <div
              style={{
                padding: 20,
                textAlign: 'center',
                color: '#888',
              }}
            >
              Buscando...
            </div>
          ) : !hasLoaded ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: '#888',
              }}
            >
              <b>
                Presiona ACTUALIZAR
              </b>
              <br />
              0 créditos al abrir
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: 'center',
                color: '#888',
              }}
            >
              No hay SHARP para{' '}
              {tab}.
            </div>
          ) : (
            filtered.map(
              (row, index) => (
                <div
                  key={`${row.partido}-${row.team}-${row.senal}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '2fr 1.5fr 0.8fr 0.6fr 0.6fr 1fr',
                    padding: '12px',
                    borderTop:
                      '1px solid #222',
                    fontSize: 13,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    {row.partido}
                    <br />

                    <span
                      style={{
                        fontSize: 11,
                        color: '#00ff88',
                      }}
                    >
                      {row.team}
                    </span>

                    <br />

                    <span
                      style={{
                        fontSize: 9,
                        color: '#888',
                      }}
                    >
                      {row.signalFull}
                      <br />
                      {row.publicoFull}
                    </span>
                  </div>

                  <div
                    style={{
                      color: '#aaa',
                      fontSize: 12,
                    }}
                  >
                    {row.pinnacle}
                  </div>

                  <div
                    style={{
                      fontWeight: 700,
                      color:
                        row.publico ===
                        'STEAM'
                          ? '#ffaa00'
                          : 'white',
                    }}
                  >
                    {row.publico}
                  </div>

                  <div
                    style={{
                      color:
                        row.movNum < 0
                          ? '#00ff88'
                          : '#ff5555',
                      fontWeight: 700,
                    }}
                  >
                    {row.mov}
                  </div>

                  <div
                    style={{
                      fontFamily:
                        'monospace',
                      fontWeight: 700,
                    }}
                  >
                    {row.precio}
                  </div>

                  <div>
                    <span
                      style={{
                        background:
                          row.senal ===
                          'STEAM'
                            ? '#ffaa0022'
                            : '#00ff8822',
                        border:
                          row.senal ===
                          'STEAM'
                            ? '1px solid #ffaa00'
                            : '1px solid #00ff88',
                        color:
                          row.senal ===
                          'STEAM'
                            ? '#ffaa00'
                            : '#00ff88',
                        padding:
                          '4px 8px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {row.senal}
                    </span>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  )
}
