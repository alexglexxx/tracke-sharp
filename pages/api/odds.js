
export default async function handler(req, res) {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) {
    return res.status(200).json({ mode: 'MOCK', message: 'No hay ODDS_API_KEY en Environment Variables - usando datos mock' })
  }

  try {
    // Ejemplo: trae NFL, MLB, Liga MX (soccer_mexico) de Pinnacle + otros books para comparar
    const sports = ['americanfootball_nfl', 'baseball_mlb', 'soccer_mexico_clausura']
    let allData = []

    for (const sport of sports) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=us&markets=spreads,h2h&oddsFormat=american&bookmakers=pinnacle,betmgm,draftkings`
      const r = await fetch(url)
      if (!r.ok) continue
      const data = await r.json()
      allData.push({ sport, data: data.slice(0, 5) }) // solo 5 juegos por liga para no gastar requests
    }

    res.status(200).json({ 
      mode: 'REAL', 
      message: 'Datos reales de The Odds API - Pinnacle',
      remaining: req.headers['x-requests-remaining'] || 'ver header',
      data: allData 
    })
  } catch (e) {
    res.status(500).json({ mode: 'ERROR', error: e.message })
  }
}
