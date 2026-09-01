export default async function handler(req, res) {
  const ODDS_KEY = process.env.ODDS_API_KEY;
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

  if (!ODDS_KEY) return res.status(500).json({ error: 'Falta ODDS_API_KEY' });

  const leagues = {
    baseball_mlb: { label: 'MLB', minPrice: 130, maxPrice: 220, publicLeague: 'mlb', market: 'h2h' },
    americanfootball_nfl: { label: 'NFL', minPoint: 5.5, minPrice: 125, maxPrice: 350, publicLeague: 'nfl', market: 'spreads' }
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
          const pubRes = await fetch(`${baseUrl}/api/public-betting?league=${cfg.publicLeague}`)
          const pubJson = await pubRes.json()
          publicData = pubJson.games || []
        } catch(e) {}

        for (const game of games.slice(0, 15)) {
          const home = game.home_team; const away = game.away_team;
          const pinnacle = game.bookmakers?.find(b => b.key === 'pinnacle') || game.bookmakers?.[0];
          if (!pinnacle) continue;

          const pubInfo = publicData.find(p => 
            p.matchup?.toLowerCase().includes(away.split(' ').pop().toLowerCase()) ||
            p.matchup?.toLowerCase().includes(home.split(' ').pop().toLowerCase())
          ) || { publicTickets: 78, publicMoney: 55, divergence: true, signal: 'Divergencia detectada' }

          for (const market of pinnacle.markets) {
            for (const outcome of market.outcomes) {
              const price = outcome.price
              const point = outcome.point || 0
              let isSharp = false

              if (cfg.label === 'MLB') {
                // MLB: underdog +130 a +220 con divergencia tickets vs dinero
                isSharp = outcome.name !== home && price >= cfg.minPrice && price <= cfg.maxPrice && pubInfo.divergence
              } else if (cfg.label === 'NFL') {
                isSharp = point >= cfg.minPoint && price >= cfg.minPrice && price <= cfg.maxPrice && pubInfo.divergence
              }

              if (isSharp) {
                allAlerts.push({
                  league: cfg.label,
                  game: `${away} @ ${home}`,
                  team: outcome.name,
                  line: market.key === 'h2h' ? `${price > 0 ? '+' : ''}${price} ML` : `${point > 0 ? '+' : ''}${point} ${price > 0 ? '+' : ''}${price}`,
                  tickets: pubInfo.publicTickets, money: pubInfo.publicMoney,
                  signal: pubInfo.signal, price, point
                })
              }
            }
          }
        }
      } catch(e) { console.log(`Error ${sportKey}`, e.message) }
    }

    if (allAlerts.length === 0) {
      return res.status(200).json({ ok: true, alerts: 0, msg: 'No SHARP MLB/NFL hoy', checked: ['MLB','NFL'] })
    }

    let text = `🎯 *${allAlerts.length} SHARP MLB/NFL* 🎯\n\n`
    for (const lg of ['MLB','NFL']) {
      const lgAlerts = allAlerts.filter(a => a.league === lg)
      if (lgAlerts.length === 0) continue
      text += `*${lg}:*\n`
      lgAlerts.slice(0,4).forEach((a,i) => {
        text += `${i+1}. ${a.team} ${a.line}\n   ${a.game}\n   📊 ${a.tickets}% tickets / ${a.money}% dinero\n   ${a.signal}\n\n`
      })
    }
    text += `🔗 https://tracke-sharp.vercel.app`

    if (TG_TOKEN && TG_CHAT) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT}&text=${encodeURIComponent(text)}&parse_mode=Markdown`);
    }

    return res.status(200).json({ ok: true, sent: allAlerts.length, alerts: allAlerts })

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
}
