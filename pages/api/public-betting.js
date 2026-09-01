export default async function handler(req, res) {
  const league = (req.query.league || 'mlb').toLowerCase()
  const ODDS_KEY = process.env.ODDS_API_KEY;

  const sportMap = {
    mlb: 'baseball_mlb',
    nfl: 'americanfootball_nfl'
  }
  const sportKey = sportMap[league] || 'baseball_mlb';

  try {
    let games = []

    // 1. Intentar traer juegos REALES de The Odds API (misma fuente que Telegram)
    if (ODDS_KEY) {
      try {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h&oddsFormat=american&bookmakers=pinnacle,draftkings`;
        const r = await fetch(oddsUrl);
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          games = data.map(g => ({
            matchup: `${g.away_team} @ ${g.home_team}`,
            away: g.away_team,
            home: g.home_team,
            commence_time: g.commence_time,
            league: league.toUpperCase(),
            publicTickets: null,
            publicMoney: null,
            divergence: false,
            signal: 'Juego real de hoy - sin datos de tickets aún',
            isReal: true
          }))
        }
      } catch(e) {
        console.log('Odds API error', e.message)
      }
    }

    // 2. Si Odds API no trajo nada, intentar Action Network solo para datos publicos
    if (games.length === 0) {
      const actionUrls = [
        `https://api.actionnetwork.com/web/v1/scoreboard/${league}?period=game`,
        `https://api.actionnetwork.com/web/v1/scoreboard/${league}`
      ]
      for (const url of actionUrls) {
        try {
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.actionnetwork.com/' } })
          const j = await r.json()
          const cand = j.games || j.scoreboard?.games || []
          if (cand.length > 0) {
            games = cand.map(g => {
              const away = g.away_team?.display_name || g.away_team?.short_name
              const home = g.home_team?.display_name || g.home_team?.short_name
              if (!away || !home) return null
              const tickets = g.public_betting?.tickets_pct
              const money = g.public_betting?.money_pct
              const divergence = tickets && money ? (tickets >= 72 && money <= 62) : false
              return {
                matchup: `${away} @ ${home}`, away, home,
                publicTickets: tickets ? Math.round(tickets) : null,
                publicMoney: money ? Math.round(money) : null,
                divergence,
                sharpSide: divergence ? away : null,
                signal: divergence ? `SHARP - ${Math.round(tickets)}% tickets pero solo ${Math.round(money)}% dinero` : 'Juego real',
                league: league.toUpperCase(),
                isReal: true
              }
            }).filter(Boolean)
            if (games.length > 0) break
          }
        } catch(e) {}
      }
    }

    // 3. Si no hay juegos reales hoy, regresar VACIO (no falsos)
    if (games.length === 0) {
      return res.status(200).json({ 
        ok: true, 
        source: `real-${league}-empty`, 
        league: league.toUpperCase(), 
        games: [],
        msg: 'No hay juegos reales hoy'
      })
    }

    return res.status(200).json({ ok: true, source: `real-${league}-live`, league: league.toUpperCase(), games })

  } catch (e) {
    // En error, también vacio, no falsos
    return res.status(200).json({ ok: true, source: `real-${league}-error`, league: league.toUpperCase(), games: [], error: e.message })
  }
}
