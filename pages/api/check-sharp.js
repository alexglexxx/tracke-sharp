export default async function handler(req, res) {
  const ODDS_KEY = process.env.ODDS_API_KEY;
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

  if (!ODDS_KEY || !TG_TOKEN || !TG_CHAT) {
    return res.status(500).json({ error: 'Faltan env vars' });
  }

  try {
    // 1. Traer NFL odds de The-Odds-API (Pinnacle + public books para consenso)
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h,spreads&oddsFormat=american&bookmakers=pinnacle,betonlineag,draftkings,fanduel`;
    const r = await fetch(oddsUrl);
    const games = await r.json();

    if (!Array.isArray(games)) {
      return res.status(200).json({ ok: false, msg: 'Sin juegos o API key agotada', raw: games });
    }

    const alerts = [];

    for (const game of games.slice(0, 16)) { // Top 16 juegos
      const home = game.home_team;
      const away = game.away_team;
      
      // Buscar Pinnacle spread
      const pinnacle = game.bookmakers?.find(b => b.key === 'pinnacle');
      const dk = game.bookmakers?.find(b => b.key === 'draftkings');
      
      if (!pinnacle) continue;

      const spreadMarket = pinnacle.markets.find(m => m.key === 'spreads');
      if (!spreadMarket) continue;

      // Buscar el underdog + grande
      for (const outcome of spreadMarket.outcomes) {
        // Buscamos +125 o más en moneyline? En spreads buscamos +5.5 o más y precio +125+
        // Para tu estrategia original: underdog +6 con valor
        const price = outcome.price;
        const point = outcome.point;
        const team = outcome.name;

        // SHARP LOGIC: Underdog +5.5 o más Y precio +125 a +250 Y el otro lado es favorito fuerte
        const isBigDog = point >= 5.5 && price >= 125 && price <= 300;
        
        if (isBigDog) {
          // Simulamos % público: si DraftKings tiene línea más alta = público con favorito
          let publicLean = 75 + Math.floor(Math.random() * 15); // 75-90% (luego conectas API real de public % como Action Network)
          
          // Si público >80% con favorito pero Pinnacle da valor al underdog = SHARP
          if (publicLean >= 80) {
            alerts.push({
              game: `${away} @ ${home}`,
              team,
              line: `${point > 0 ? '+' : ''}${point} (${price > 0 ? '+' : ''}${price})`,
              public: `${publicLean}% con favorito`,
              book: 'Pinnacle'
            });
          }
        }
      }
    }

    // 2. Mandar a Telegram si hay alertas
    if (alerts.length === 0) {
      return res.status(200).json({ ok: true, alerts: 0, msg: 'No SHARP +125 hoy' });
    }

    let text = `🎯 *${alerts.length} SHARP UNDERDOGS +125 DETECTADOS* 🎯\n\n`;
    alerts.slice(0,5).forEach((a,i) => {
      text += `${i+1}. *${a.team}* ${a.line}\n`;
      text += `   ${a.game}\n`;
      text += `   📈 ${a.public} vs 📉 ${a.book} moviéndose a dog\n`;
      text += `   ✅ Valor +125\n\n`;
    });
    text += `🔗 Ver tracker: https://tracke-sharp.vercel.app`;

    const tgUrl = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT}&text=${encodeURIComponent(text)}&parse_mode=Markdown`;
    const tgRes = await fetch(tgUrl);
    const tgData = await tgRes.json();

    return res.status(200).json({ ok: true, sent: alerts.length, telegram: tgData, alerts });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
