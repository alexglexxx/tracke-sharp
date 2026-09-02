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

          let pubInfo = publicData.find(p =>
            p.matchup?.toLowerCase().includes(away.split(' ').pop().toLowerCase()) ||
            p.matchup?.toLowerCase().includes(home.split(' ').pop().toLowerCase())
          )

          for (const market of pinnacle.markets) {
            for (const outcome of market.outcomes) {
              const price = outcome.price
              const point = outcome.point || 0
              const isUnderdog = outcome.name!== home
              if (!isUnderdog) continue

              let dkPrice = null, dkPoint = null
              if (dk) {
                const dkMarket = dk.markets.find(m => m.key === market.key)
                const dkOutcome = dkMarket?.outcomes.find(o => o.name === outcome.name)
                if (dkOutcome) {
                  dkPrice = dkOutcome.price
                  dkPoint = dkOutcome.point || 0
                }
              }

              let isSharp = false
              let tickets = pubInfo?.publicTickets || null
              let money = pubInfo?.publicMoney || null
              let signal = ''

              // CASO 1: Public REAL 78%+ tickets vs <=62% dinero = SHARP REAL (ej: Commanders 84%/59%)
              if (pubInfo && pubInfo.publicTickets && pubInfo.publicMoney) {
                const div = pubInfo.publicTickets >= 78 && pubInfo.publicMoney <= 62
                if (div) {
                  if (cfg.label === 'MLB' && price >= cfg.minPrice && price <= cfg.maxPrice) {
                    isSharp = true
                    signal = `SHARP - Pinnacle ${price} vs DK ${dkPrice || 'N/A'} - ${pubInfo.publicTickets}% tickets fav / ${pubInfo.publicMoney}% dinero - esta jornada`
                  }
                  if (cfg.label === 'NFL' && point >= cfg.minPoint) {
                    isSharp = true
                    signal = `SHARP - Pinnacle ${point} ${price} vs DK ${dkPoint} ${dkPrice} - ${pubInfo.publicTickets}% tickets fav / ${pubInfo.publicMoney}% dinero - esta jornada`
                  }
                }
              }
              // CASO 2: Sin public, STEAM REAL Pinnacle vs DK - SIN inventar %
              else if (dkPrice!== null) {
                if (cfg.label === 'MLB' && price >= cfg.minPrice && price <= cfg.maxPrice) {
                  if (dkPrice - price >= 12) {
                    isSharp = true
                    tickets = null; money = null
                    signal = `STEAM SHARP - Pinnacle ${price > 0? '+'+price : price} vs DK ${dkPrice > 0? '+'+dkPrice : dkPrice} - esta jornada`
                  }
                }
                if (cfg.label === 'NFL' && point >= 3.5) {
                  const lineDiff = dkPoint!== null? dkPoint - point : 0
                  const priceDiff = dkPrice!== null? dkPrice - price : 0
                  if (lineDiff >= 0.5 || priceDiff >= 12) {
                    isSharp = true
                    tickets = null; money = null
                    signal = `STEAM SHARP - Pinnacle ${point} ${price} vs DK ${dkPoint} ${dkPrice} - esta jornada`
                  }
                }
              }

              if (isSharp) {
                allAlerts.push({
                  league: cfg.label,
                  game: `${away} @ ${home}`,
                  team: outcome.name,
                  line: market.key === 'h2h'? `${price > 0? '+' : ''}${price} ML` : `${point > 0? '+' : ''}${point} ${price > 0? '+' : ''}${price}`,
                  tickets, money, signal, price, point,
                  jornada: cfg.jornada,
                  isSteam: tickets === null
                })
              }
            }
          }
        }
      } catch(e) { console.log(`Error ${sportKey}`, e.message) }
    }

    const unique = []
    const seen = new Set()
    for (const a of allAlerts) {
      const key = a.game + a.team
      if (!seen.has(key)) { seen.add(key); unique.push(a) }
    }
    unique.sort((a,b) => {
      if (a.tickets && b.tickets) return (b.tickets - b.money) - (a.tickets - a.money)
      if (a.tickets &&!b.tickets) return -1
      if (!a.tickets && b.tickets) return 1
      return 0
    })
    const finalAlerts = unique.slice(0, 3)

    if (finalAlerts.length === 0) {
      return res.status(200).json({ ok: true, alerts: [], count: 0, msg: 'No SHARP esta jornada - vacio intencional', checked: ['MLB','NFL'] })
    }

    let text = `🎯 *${finalAlerts.length} SHARP esta jornada* 🎯\n\n`
    for (const lg of ['MLB','NFL']) {
      const lgAlerts = finalAlerts.filter(a => a.league === lg)
      if (lgAlerts.length === 0) continue
      text += `*${lg}:*\n`
      lgAlerts.forEach((a,i) => {
        const stats = a.isSteam? `📊 STEAM Pinnacle vs DK` : `📊 ${a.tickets}% tickets / ${a.money}% dinero`
        text += `${i+1}. ${a.team} ${a.line}\n ${a.game}\n ${stats}\n ${a.signal}\n\n`
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
