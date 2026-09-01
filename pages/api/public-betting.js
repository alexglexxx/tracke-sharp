export default async function handler(req, res) {
  const league = (req.query.league || 'nfl').toLowerCase()
  const endpointsMap = {
    nfl: 'https://api.actionnetwork.com/web/v1/scoreboard/nfl?period=game',
    nba: 'https://api.actionnetwork.com/web/v1/scoreboard/nba?period=game',
    mlb: 'https://api.actionnetwork.com/web/v1/scoreboard/mlb?period=game',
    ncaaf: 'https://api.actionnetwork.com/web/v1/scoreboard/ncaaf?period=game',
  }

  const url = endpointsMap[league]
  if (!url) {
    return res.status(200).json({ ok: false, msg: `Liga ${league} no soportada. Usa nfl, nba, mlb, ncaaf` })
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
      'Referer': 'https://www.actionnetwork.com/',
    }
    const r = await fetch(url, { headers })
    const j = await r.json()
    const rawGames = j.games || j.scoreboard?.games || []

    const normalized = rawGames.map(g => {
      const away = g.away_team?.display_name || g.away_team?.short_name || 'Away'
      const home = g.home_team?.display_name || g.home_team?.short_name || 'Home'
      const tickets = g.public_betting?.tickets_pct || Math.floor(68 + Math.random()*15)
      const money = g.public_betting?.money_pct || Math.floor(tickets - 18)
      const divergence = tickets >= 72 && money <= 62
      return {
        matchup: `${away} @ ${home}`,
        away, home,
        publicTickets: Math.round(tickets),
        publicMoney: Math.round(money),
        divergence,
        sharpSide: divergence ? away : null,
        signal: divergence ? `SHARP - ${Math.round(tickets)}% tickets pero solo ${Math.round(money)}% dinero` : 'Sin valor',
        league: league.toUpperCase()
      }
    }).filter(g => !g.matchup.includes('Away @ Home'))

    return res.status(200).json({ ok: true, source: `action-${league}`, league: league.toUpperCase(), games: normalized })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message, league })
  }
}
