
export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    return res.status(200).json({ ok: false, msg: 'Falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en Vercel Environment Variables' })
  }

  // Ejemplo de mensaje SHARP - luego esto lo llamará tu tracker automáticamente
  const { message } = req.query
  const text = message || `🎯 *SHARP ALERT - Tracker Sharp Underdogs*\n\n` +
    `📊 *NFL:* Chargers +6.0 (+185)\n` +
    `📈 82% público con Chiefs\n` +
    `📉 Pinnacle bajó de +6.5 a +6.0\n` +
    `✅ Señal: DINERO INTELIGENTE vs público\n\n` +
    `🔗 Ver en: https://tracke-sharp.vercel.app`

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}&parse_mode=Markdown`
    const r = await fetch(url)
    const data = await r.json()
    res.status(200).json({ ok: true, telegram: data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
