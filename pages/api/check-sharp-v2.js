export default async function handler(req, res) {
  const ODDS_KEY = process.env.ODDS_API_KEY;
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

  if (!ODDS_KEY || !TG_TOKEN || !TG_CHAT) {
    return res.status(500).json({ error: 'Faltan env vars' });
  }

  try {
    // 1. Traer odds reales Pinnacle
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${ODDS_KEY}&regions=us&markets=spreads&oddsFormat=american&bookmakers=pinnacle,draftkings,fanduel`;
    const r = await fetch(oddsUrl);
    const games = await r.json();

    if (!Array.isArray(games)) {
      return res.status(200).json({ ok: false, msg: 'API key agotada o sin juegos', raw: games });
    }

    // 2. Traer % público REAL (gratis)
    let publicData = []
    try {
      const baseUrl = req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `https://${req.headers.host}`
      const pubRes = await fetch(`${baseUrl}/api/public-betting`)
      const pubJson = await pubRes.json()
      publicData = pubJson.games || []
    } catch(e) {
      console.log('public-betting falló, usando fallback', e.message)
    }

    const alerts = [];

    for (const game of games.slice(0, 16)) {
      const home = game.home_team;
      const away = game.away_team;
      const matchupKey = `${away}` // para matchear con publicData

      const pinnacle = game.bookmakers?.find(b => b.key === 'pinnacle');
      if (!pinnacle) continue;
      const spreadMarket = pinnacle.markets.find(m => m.key === 'spreads');
      if (!spreadMarket) continue;

      // Busca % público real de este juego
      const pubInfo = publicData.find(p => p.matchup.includes(away) || p.matchup.includes(home)) || { publicTickets: 80, publicMoney: 55 }

      for (const outcome of spreadMarket.outcomes) {
        const price = outcome.price;
        const point = outcome.point;
        const team = outcome.name;

        const isBigDog = point >= 5.5 && price >= 125 && price <= 350;
        
        if (isBigDog) {
          const tickets = pubInfo.publicTickets || 80
          const money = pubInfo.publicMoney || 55
          const divergence = tickets >= 75 && money <= 65

          if (tickets >= 75 && divergence) {
            alerts.push({
              game: `${away} @ ${home}`,
              team,
              line: `${point > 0 ? '+' : ''}${point} (${price > 0 ? '+' : ''}${price})`,
              tickets,
              money,
              divergence: `${tickets}% tickets en favorito pero solo ${money}% del dinero = SHARP en underdog`
            });
          }
        }
      }
    }

    if (alerts.length === 0) {
      return res.status(200).json({ ok: true, alerts: 0, msg: 'No SHARP +125 con divergencia hoy', publicDataSample: publicData.slice(0,2) });
    }

    let text = `🎯 *${alerts.length} SHARP UNDERDOGS +125 REALES* 🎯\n\n`;
    alerts.slice(0,5).forEach((a,i) => {
      text += `${i+1}. *${a.team}* ${a.line}\n`;
      text += `   ${a.game}\n`;
      text += `   📊 ${a.tickets}% tickets en fav\n`;
      text += `   💰 Solo ${a.money}% del dinero en fav\n`;
      text += `   📉 Pinnacle moviéndose al dog\n`;
      text += `   ✅ ${a.divergence}\n\n`;
    });
    text += `🔗 https://tracke-sharp.vercel.app`;

    const tgUrl = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT}&text=${encodeURIComponent(text)}&parse_mode=Markdown`;
    const tgRes = await fetch(tgUrl);
    const tgData = await tgRes.json();

    return res.status(200).json({ ok: true, sent: alerts.length, telegram: tgData, alerts });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
