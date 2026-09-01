export default async function handler(req, res) {
  const league = (req.query.league || 'mlb').toLowerCase()
  const ODDS_KEY = process.env.ODDS_API_KEY;
  const sportMap = { mlb: 'baseball_mlb', nfl: 'americanfootball_nfl' }
  const sportKey = sportMap[league] || 'baseball_mlb';
  const getTodayCDMX = () => {
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' })
    const d = new Date(now)
    return d.toISOString().split('T')[0]
  }
  try {
    let realGames = []
    let publicMap = {}
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
            publicMap[key] = { tickets: g.public_betting?.tickets_pct || null, money: g.public_betting?.money_pct || null }
          }
          if (Object.keys(publicMap).length > 0) break
        } catch(e){}
      }
    } catch(e){}
    if (ODDS_KEY) {
      try {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h&oddsFormat=american&bookmakers=pinnacle,draftkings`;
        const r = await fetch(oddsUrl);
        const data = await r.json();
        if (Array.isArray(data)) {
          const todayStr = getTodayCDMX()
          const todayGames = data.filter(g => {
            const commence = new Date(g.commence_time)
            const commenceCDMX = new Date(commence.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }))
            const commenceStr = commenceCDMX.toISOString().split('T')[0]
            return commenceStr === todayStr
          })
          const sourceGames = todayGames.length > 0 ? todayGames : data.filter(g => {
            const d = new Date(g.commence_time).toISOString().split('T')[0]
            return d === new Date().toISOString().split('T')[0]
          }).slice(0, 15)
          realGames = (sourceGames.length > 0 ? sourceGames : data.slice(0,15)).map(g => {
            const matchup = `${g.away_team} @ ${g.home_team}`
            const key = matchup.toLowerCase()
            const pub = publicMap[key] || {}
            const tickets = pub.tickets
            const money = pub.money
            const divergence = tickets && money ? (tickets >= 72 && money <= 62) : false
            return {
              matchup,
              away: g.away_team,
              home: g.home_team,
              commence_time: g.commence_time,
              league: league.toUpperCase(),
              publicTickets: tickets ? Math.round(tickets) : null,
              publicMoney: money ? Math.round(money) : null,
              divergence,
              sharpSide: divergence ? g.away_team : null,
              signal: divergence ? `SHARP - ${Math.round(tickets)}% tickets / ${Math.round(money)}% dinero` : (tickets ? 'Juego real con datos publicos' : 'Juego real de hoy'),
              isReal: true
            }
          })
        }
      } catch(e) { console.log('Odds error', e.message) }
    }
    if (realGames.length === 0) {
      return res.status(200).json({ ok: true, source: `real-${league}-empty`, league: league.toUpperCase(), games: [], msg: 'No hay juegos reales hoy - vacio intencional' })
    }
    return res.status(200).json({ ok: true, source: `real-${league}-live-today`, league: league.toUpperCase(), count: realGames.length, games: realGames })
  } catch (e) {
    return res.status(200).json({ ok: true, source: `real-${league}-error`, league: league.toUpperCase(), games: [], error: e.message })
  }
}
