export default async function handler(req, res) {
  const league = (req.query.league || 'mlb').toLowerCase()
  const isNFL = league === 'nfl'

  try {
    let publicMap = {}
    let realGames = []
    try {
      const urls = [
        `https://api.actionnetwork.com/web/v1/scoreboard/${league}?period=game`,
        `https://api.actionnetwork.com/web/v1/scoreboard/${league}`
      ]
      for (const url of urls) {
        try {
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.actionnetwork.com/' } })
          const j = await r.json()
          const cand = j.games || j.scoreboard?.games || []
          for (const g of cand) {
            const away = g.away_team?.display_name || g.away_team?.short_name || ''
            const home = g.home_team?.display_name || g.home_team?.short_name || ''
            const key = `${away} @ ${home}`.toLowerCase()
            const tickets = g.public_betting?.tickets_pct || null
            const money = g.public_betting?.money_pct || null
            publicMap[key] = { tickets, money }
            if (tickets && money && tickets >= 50) {
              realGames.push({
                matchup: `${away} @ ${home}`,
                publicTickets: Math.round(tickets),
                publicMoney: Math.round(money),
                divergence: tickets >= 78 && money <= 62,
                signal: tickets >= 78 && money <= 62? `SHARP - ${Math.round(tickets)}% tickets / ${Math.round(money)}% dinero` : `Public ${Math.round(tickets)}% / ${Math.round(money)}%`,
                jornada: isNFL? 'esta jornada' : 'hoy'
              })
            }
          }
          if (Object.keys(publicMap).length > 0) break
        } catch(e){}
      }
    } catch(e){}

    return res.status(200).json({
      ok: true,
      source: `public-only-${league} - 0 creditos`,
      league: league.toUpperCase(),
      count: realGames.length,
      games: realGames,
      map: publicMap,
      jornada: isNFL? 'esta jornada' : 'hoy'
    })
  } catch (e) {
    return res.status(200).json({ ok: true, source: `public-error`, league: league.toUpperCase(), games: [], error: e.message })
  }
}
