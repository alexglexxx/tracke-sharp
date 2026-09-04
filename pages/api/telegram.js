const REQUEST_TIMEOUT_MS = 8000

function withTimeout(url, options = {}) {
  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout)
  })
}

function isAuthorized(req) {
  const secret = process.env.INTERNAL_API_SECRET

  if (!secret) {
    return false
  }

  const authorization = req.headers.authorization || ''

  return authorization === `Bearer ${secret}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')

    return res.status(405).json({
      ok: false,
      error: 'Method Not Allowed',
    })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: 'No autorizado.',
    })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    return res.status(500).json({
      ok: false,
      error:
        'Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID.',
    })
  }

  const message =
    typeof req.body?.message === 'string'
      ? req.body.message.trim()
      : ''

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: 'message es obligatorio.',
    })
  }

  if (message.length > 4000) {
    return res.status(400).json({
      ok: false,
      error: 'El mensaje excede 4000 caracteres.',
    })
  }

  try {
    const params = new URLSearchParams({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    })

    const response = await withTimeout(
      `https://api.telegram.org/bot${token}/sendMessage?${params.toString()}`
    )

    const data = await response.json()

    if (!response.ok || !data.ok) {
      return res.status(502).json({
        ok: false,
        error:
          data?.description ||
          'Telegram rechazó el mensaje.',
      })
    }

    return res.status(200).json({
      ok: true,
      messageId:
        data.result?.message_id || null,
    })
  } catch (error) {
    console.error(
      'Telegram endpoint error:',
      error
    )

    return res.status(502).json({
      ok: false,
      error: 'No fue posible contactar Telegram.',
    })
  }
}
