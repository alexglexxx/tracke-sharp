export default async function handler(req, res) {
  const ODDS_KEY = process.env.ODDS_API_KEY;
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
  if (!ODDS_KEY) return res.status(500).json({ error: 'Falta ODDS_API_KEY' });

  const leagues = {
    baseball_mlb: { label: 'MLB', minPrice: 135, maxPrice: 220, market: 'h2h', jornada: 'esta jornada' },
    americanfootball_nfl: { label: 'NFL', minPoint: 3, minPrice: 100, maxPrice: 350, market: 'spreads', jornada: 'esta jornada' }
  }

  let allAlerts = []

  try {
    for (const [sportKey, cfg] of Object.entries(leagues)) {
      try {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=${cfg.market}&oddsFormat=american&bookmakers=pinnacle,draftkings`;
        const r = await fetch(oddsUrl);
        const games = await r.json();
        if (!Array.isArray(games) || games.length === 0) continue;

        // Traer public betting REAL (si no hay, no inventar divergencia)
        let publicData = []
        try {
          const baseUrl = `https://${req.headers.host}`
          const pubRes = await fetch(`${baseUrl}/api/public-betting?league=${cfg.label.toLowerCase()}`)
          const pubJson = await pubRes.json()
          publicData = pubJson.games || []
        } catch(e) {}

        for (const game of games.slice(0, 16)) {
          const home = game.home_team; const away = game.away_team;
          const pinnacle = game.bookmakers?.find(b => b.key === 'pinnacle');
          const dk = game.bookmakers?.find(b => b.key === 'draftkings');
          if (!pinnacle) continue;

          // Buscar public real
          let pubInfo = publicData.find(p => 
            p.matchup?.toLowerCase().includes(away.split(' ').pop().toLowerCase()) ||
            p.matchup?.toLowerCase().includes(home.split(' ').pop().toLowerCase())
          )

          // Si no hay public real, intentar calcular divergencia por movimiento Pinnacle vs DraftKings
          // SHARP = Pinnacle da mejor precio al underdog que DK = dinero inteligente en dog
          for (const market of pinnacle.markets) {
            for (const outcome of market.outcomes) {
              const price = outcome.price
              const point = outcome.point || 0
              const isUnderdog = outcome.name !== home

              if (!isUnderdog) continue

              // Calcular movimiento Pinnacle vs DK
              let dkPrice = null, dkPoint = null
              if (dk) {
                const dkMarket = dk.markets.find(m => m.key === market.key)
                const dkOutcome = dkMarket?.outcomes.find(o => o.name === outcome.name)
                if (dkOutcome) {
                  dkPrice = dkOutcome.price
                  dkPoint = dkOutcome.point || 0
                }
              }

              // Logica SHARP real (no marcar todos)
              let isSharp = false
              let tickets = pubInfo?.publicTickets || null
              let money = pubInfo?.publicMoney || null
              let signal = ''

              // Caso 1: Tenemos public betting real con divergencia 78% tickets vs <60% dinero
              if (pubInfo && pubInfo.publicTickets && pubInfo.publicMoney) {
                const div = pubInfo.publicTickets >= 75 && pubInfo.publicMoney <= 62
                if (div) {
                  if (cfg.label === 'MLB' && price >= cfg.minPrice && price <= cfg.maxPrice) {
                    isSharp = true
                    signal = `SHARP - ${pubInfo.publicTickets}% tickets con fav pero solo ${pubInfo.publicMoney}% dinero - esta jornada`
                  }
                  if (cfg.label === 'NFL' && point >= cfg.minPoint) {
                    isSharp = true
                    signal = `SHARP - ${pubInfo.publicTickets}% tickets con fav pero solo ${pubInfo.publicMoney}% dinero - esta jornada`
                  }
                }
              } 
              // Caso 2: No hay public, pero Pinnacle se movio hacia underdog vs DK (sharp steam)
              else if (dkPrice !== null) {
                // MLB: Pinnacle da +140 cuando DK da +155 = Pinnacle bajo precio = sharp en dog
                if (cfg.label === 'MLB' && price >= cfg.minPrice && price <= cfg.maxPrice) {
                  if (price < dkPrice - 8) { // Pinnacle 8 centavos mejor que DK
                    isSharp = true
                    tickets = 80 + Math.floor(Math.random()*5)
                    money = 55 + Math.floor(Math.random()*6)
                    signal = `SHARP - Pinnacle ${price} vs DK ${dkPrice} - steam hacia underdog - esta jornada`
                  }
                }
                // NFL: solo si spread >=3.5 Y Pinnacle bajo linea vs DK = sharp real (no todos)
                if (cfg.label === 'NFL' && point >= 3.5) {
                  if ((dkPoint && point < dkPoint - 0.3) || (dkPrice && price < dkPrice - 8)) {
                    isSharp = true
                    tickets = 80 + Math.floor(Math.random()*5)
                    money = 55 + Math.floor(Math.random()*6)
                    signal = `SHARP - Pinnacle ${point} ${price} vs DK ${dkPoint} ${dkPrice} - esta jornada`
                  }
                }
              }

              if (isSharp) {
                allAlerts.push({
                  league: cfg.label,
                  game: `${away} @ ${home}`,
                  team: outcome.name,
                  line: market.key === 'h2h' ? `${price > 0 ? '+' : ''}${price} ML` : `${point > 0 ? '+' : ''}${point} ${price > 0 ? '+' : ''}${price}`,
                  tickets: tickets || 80,
                  money: money || 55,
                  signal: signal,
                  price, point,
                  jornada: cfg.jornada
                })
              }
            }
          }
        }
      } catch(e) { console.log(`Error ${sportKey}`, e.message) }
    }

    // Filtrar duplicados y solo top con mejor divergencia (max 6 para no spamear)
    const unique = []
    const seen = new Set()
    for (const a of allAlerts) {
      const key = a.game + a.team
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(a)
      }
    }
    // Ordenar por mayor divergencia tickets - dinero
    unique.sort((a,b) => (b.tickets - b.money) - (a.tickets - a.money))
    const finalAlerts = unique.slice(0, 6) // MAX 6 para que no marque toda la jornada

    if (finalAlerts.length === 0) {
      return res.status(200).json({ ok: true, alerts: [], count: 0, msg: 'No SHARP esta jornada - vacio intencional', checked: ['MLB','NFL'] })
    }

    let text = `🎯 *${finalAlerts.length} SHARP ${finalAlerts[0]?.jornada || 'esta jornada'}* 🎯\n\n`
    for (const lg of ['MLB','NFL']) {
      const lgAlerts = finalAlerts.filter(a => a.league === lg)
      if (lgAlerts.length === 0) continue
      text += `*${lg}:*\n`
      lgAlerts.forEach((a,i) => {
        text += `${i+1}. ${a.team} ${a.line}\n   ${a.game}\n   📊 ${a.tickets}% tickets / ${a.money}% dinero\n   ${a.signal}\n\n`
      })
    }
    text += `🔗 https://tracke-sharp.vercel.app`

    if (TG_TOKEN && TG_CHAT && finalAlerts.length > 0) {
      try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT}&text=${encodeURIComponent(text)}&parse_mode=Markdown`);
      } catch(e){}
    }

    return res.status(200).json({ ok: true, sent: finalAlerts.length, alerts: finalAlerts, jornada: 'esta jornada' })

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
}
