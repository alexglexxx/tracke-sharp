const ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports'

const REQUEST_TIMEOUT_MS = 10000

const CONFIG = {
  MLB: {
    sportKey: 'baseball_mlb',
    label: 'MLB',
    market: 'h2h',
    minPrice: 100,
    maxPrice: 260,
    publicTicketsMin: 70,
    publicMoneyMax: 65,
  },

  NFL: {
    sportKey: 'americanfootball_nfl',
    label: 'NFL',
    market: 'spreads',
    minPoint: 3,
    publicTicketsMin: 78,
    publicMoneyMax: 62,
    steamLineDiffMin: 0.5,
    steamPriceDiffMin: 12,
  },
}

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

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function formatAmericanPrice(price) {
  if (!Number.isFinite(price)) {
    return 'N/A'
  }

  return price > 0 ? `+${price}` : `${price}`
}

function formatPoint(point) {
  if (!Number.isFinite(point)) {
    return 'N/A'
  }

  return point > 0 ? `+${point}` : `${point}`
}

function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function findBookmaker(game, key) {
  return (
    game.bookmakers?.find((bookmaker) => bookmaker.key === key) ||
    null
  )
}

function findMarket(bookmaker, marketKey) {
  return (
    bookmaker?.markets?.find((market) => market.key === marketKey) ||
    null
  )
}

function findOutcome(market, teamName) {
  if (!market?.outcomes) {
    return null
  }

  const target = normalizeName(teamName)

  return (
    market.outcomes.find(
      (outcome) => normalizeName(outcome.name) === target
    ) || null
  )
}

function determineMoneylineUnderdog(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length < 2) {
    return null
  }

  const valid = outcomes.filter((outcome) =>
    isValidNumber(outcome.price)
  )

  if (valid.length < 2) {
    return null
  }

  /*
   * En moneyline americano:
   *
   * - precio positivo = underdog
   * - precio negativo = favorito
   *
   * Si ambos son positivos, usamos el precio mayor
   * como underdog más claro.
   *
   * Si ambos son negativos, no existe underdog por precio
   * americano convencional.
   */

  const positive = valid.filter((outcome) => outcome.price > 0)

  if (positive.length === 1) {
    return positive[0]
  }

  if (positive.length >= 2) {
    return positive.reduce((best, current) =>
      current.price > best.price ? current : best
    )
  }

  return null
}

function determineSpreadUnderdog(outcomes) {
  if (!Array.isArray(outcomes)) {
    return null
  }

  const valid = outcomes.filter((outcome) =>
    isValidNumber(outcome.point)
  )

  if (valid.length < 2) {
    return null
  }

  /*
   * En spreads:
   *
   * favorito = punto negativo
   * underdog = punto positivo
   *
   * No inferimos por home/away.
   */

  const positive = valid.filter((outcome) => outcome.point > 0)

  if (positive.length === 0) {
    return null
  }

  return positive.reduce((best, current) => {
    if (!best) {
      return current
    }

    if (current.point > best.point) {
      return current
    }

    return best
  }, null)
}

function findPublicSide(publicGame, teamName) {
  if (!publicGame?.sides || !teamName) {
    return null
  }

  const target = normalizeName(teamName)

  for (const [key, value] of Object.entries(publicGame.sides)) {
    if (normalizeName(key) === target) {
      return value
    }

    if (normalizeName(value?.team) === target) {
      return value
    }
  }

  return null
}

function findPublicGame(publicGames, game) {
  if (!Array.isArray(publicGames)) {
    return null
  }

  const home = normalizeName(game.home_team)
  const away = normalizeName(game.away_team)

  return (
    publicGames.find((publicGame) => {
      const publicHome = normalizeName(publicGame.home?.name)
      const publicAway = normalizeName(publicGame.away?.name)

      return (
        (publicHome === home && publicAway === away) ||
        (publicHome === away && publicAway === home)
      )
    }) || null
  )
}

function calculateDivergence(tickets, money) {
  if (
    !isValidNumber(tickets) ||
    !isValidNumber(money)
  ) {
    return null
  }

  return tickets - money
}

async function getOdds(sportKey, market, apiKey) {
  const params = new URLSearchParams({
    apiKey,
    regions: 'us',
    markets: market,
    oddsFormat: 'american',
    bookmakers: 'pinnacle,draftkings',
  })

  const url = `${ODDS_API_BASE}/${sportKey}/odds/?${params.toString()}`

  const response = await withTimeout(url)

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Odds API respondió ${response.status}`
    )
  }

  if (!Array.isArray(data)) {
    throw new Error('Odds API no devolvió una lista de partidos.')
  }

  return {
    games: data,
    remaining:
      response.headers.get('x-requests-remaining') || null,
    used:
      response.headers.get('x-requests-used') || null,
  }
}

async function getPublicBetting(origin, league) {
  const url = `${origin}/api/public-betting?league=${league.toLowerCase()}`

  const response = await withTimeout(url)

  const data = await response.json()

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error ||
        `Public betting respondió ${response.status}`
    )
  }

  return data
}

function buildSharpAlert({
  league,
  game,
  outcome,
  publicSide,
  dkOutcome,
  type,
  reason,
}) {
  const isMLB = league === 'MLB'

  const price = outcome.price
  const point = isValidNumber(outcome.point)
    ? outcome.point
    : null

  const dkPrice = isValidNumber(dkOutcome?.price)
    ? dkOutcome.price
    : null

  const dkPoint = isValidNumber(dkOutcome?.point)
    ? dkOutcome.point
    : null

  const tickets = isValidNumber(publicSide?.tickets)
    ? publicSide.tickets
    : null

  const money = isValidNumber(publicSide?.money)
    ? publicSide.money
    : null

  const divergence = calculateDivergence(
    tickets,
    money
  )

  const line =
    isMLB
      ? `${formatAmericanPrice(price)} ML`
      : `${formatPoint(point)} ${formatAmericanPrice(price)}`

  let signal

  if (type === 'PUBLIC_DIVERGENCE') {
    signal =
      `${league} SHARP — ${tickets}% tickets / ` +
      `${money}% dinero — divergencia ${divergence >= 0 ? '+' : ''}${divergence} pts`
  }

  if (type === 'STEAM') {
    if (isMLB) {
      signal =
        `STEAM ${league} — Pinnacle ${formatAmericanPrice(price)} ` +
        `vs DK ${formatAmericanPrice(dkPrice)}`
    } else {
      signal =
        `STEAM ${league} — Pinnacle ${formatPoint(point)} ${formatAmericanPrice(price)} ` +
        `vs DK ${formatPoint(dkPoint)} ${formatAmericanPrice(dkPrice)}`
    }
  }

  return {
    league,
    game: `${game.away_team} @ ${game.home_team}`,
    team: outcome.name,
    line,
    price,
    point,
    tickets,
    money,
    divergence,
    dkPrice,
    dkPoint,
    type,
    isSteam: type === 'STEAM',
    signal,
    reason,
    source: {
      odds: 'The Odds API / Pinnacle',
      public: publicSide ? 'Action Network' : null,
      comparison: dkOutcome ? 'DraftKings' : null,
    },
    detectedAt: new Date().toISOString(),
  }
}

function evaluateMLB(game, publicGame) {
  const pinnacle = findBookmaker(game, 'pinnacle')

  if (!pinnacle) {
    return []
  }

  const dk = findBookmaker(game, 'draftkings')

  const pinnacleMarket = findMarket(
    pinnacle,
    'h2h'
  )

  const dkMarket = findMarket(
    dk,
    'h2h'
  )

  if (!pinnacleMarket) {
    return []
  }

  const underdog = determineMoneylineUnderdog(
    pinnacleMarket.outcomes
  )

  if (!underdog) {
    return []
  }

  if (
    !isValidNumber(underdog.price) ||
    underdog.price < CONFIG.MLB.minPrice ||
    underdog.price > CONFIG.MLB.maxPrice
  ) {
    return []
  }

  const publicSide = findPublicSide(
    publicGame,
    underdog.name
  )

  const alerts = []

  /*
   * REGLA 1:
   *
   * Solo llamamos SHARP cuando tenemos datos públicos
   * asociados específicamente al underdog.
   *
   * Nunca usamos un fallback inventado.
   */
  if (
    publicSide &&
    isValidNumber(publicSide.tickets) &&
    isValidNumber(publicSide.money)
  ) {
    const divergence = calculateDivergence(
      publicSide.tickets,
      publicSide.money
    )

    if (
      publicSide.tickets >= CONFIG.MLB.publicTicketsMin &&
      publicSide.money <= CONFIG.MLB.publicMoneyMax &&
      divergence >= 5
    ) {
      const dkOutcome = findOutcome(
        dkMarket,
        underdog.name
      )

      alerts.push(
        buildSharpAlert({
          league: 'MLB',
          game,
          outcome: underdog,
          publicSide,
          dkOutcome,
          type: 'PUBLIC_DIVERGENCE',
          reason:
            'El underdog recibe una proporción alta de tickets ' +
            'pero una proporción menor de dinero.',
        })
      )
    }
  }

  /*
   * REGLA 2:
   *
   * STEAM solamente cuando realmente tenemos
   * precio Pinnacle + precio DraftKings.
   */
  const dkOutcome = findOutcome(
    dkMarket,
    underdog.name
  )

  if (
    dkOutcome &&
    isValidNumber(dkOutcome.price) &&
    dkOutcome.price - underdog.price >= 8
  ) {
    alerts.push(
      buildSharpAlert({
        league: 'MLB',
        game,
        outcome: underdog,
        publicSide: null,
        dkOutcome,
        type: 'STEAM',
        reason:
          'DraftKings ofrece un precio considerablemente peor ' +
          'que Pinnacle sobre el mismo underdog.',
      })
    )
  }

  return alerts
}

function evaluateNFL(game, publicGame) {
  const pinnacle = findBookmaker(game, 'pinnacle')

  if (!pinnacle) {
    return []
  }

  const dk = findBookmaker(game, 'draftkings')

  const pinnacleMarket = findMarket(
    pinnacle,
    'spreads'
  )

  const dkMarket = findMarket(
    dk,
    'spreads'
  )

  if (!pinnacleMarket) {
    return []
  }

  const underdog = determineSpreadUnderdog(
    pinnacleMarket.outcomes
  )

  if (!underdog) {
    return []
  }

  if (
    !isValidNumber(underdog.point) ||
    underdog.point < CONFIG.NFL.minPoint
  ) {
    return []
  }

  const publicSide = findPublicSide(
    publicGame,
    underdog.name
  )

  const alerts = []

  /*
   * Igual que MLB:
   *
   * No podemos llamar SHARP si no sabemos
   * qué porcentaje pertenece al underdog.
   */
  if (
    publicSide &&
    isValidNumber(publicSide.tickets) &&
    isValidNumber(publicSide.money)
  ) {
    const divergence = calculateDivergence(
      publicSide.tickets,
      publicSide.money
    )

    /*
     * Aquí usamos el lado del UNDERDOG directamente.
     *
     * Esto es importante:
     *
     * tickets altos + money bajo
     * NO significa automáticamente "sharp underdog".
     *
     * Significa que existe divergencia en ese lado.
     *
     * Por eso mantenemos la etiqueta SHARP como señal
     * experimental y conservamos los datos originales.
     */
    if (
      publicSide.tickets >= CONFIG.NFL.publicTicketsMin &&
      publicSide.money <= CONFIG.NFL.publicMoneyMax &&
      divergence >= 10
    ) {
      const dkOutcome = findOutcome(
        dkMarket,
        underdog.name
      )

      alerts.push(
        buildSharpAlert({
          league: 'NFL',
          game,
          outcome: underdog,
          publicSide,
          dkOutcome,
          type: 'PUBLIC_DIVERGENCE',
          reason:
            'El underdog presenta divergencia entre tickets y dinero.',
        })
      )
    }
  }

  const dkOutcome = findOutcome(
    dkMarket,
    underdog.name
  )

  if (dkOutcome) {
    const lineDiff =
      isValidNumber(dkOutcome.point) &&
      isValidNumber(underdog.point)
        ? dkOutcome.point - underdog.point
        : 0

    const priceDiff =
      isValidNumber(dkOutcome.price) &&
      isValidNumber(underdog.price)
        ? dkOutcome.price - underdog.price
        : 0

    if (
      lineDiff >= CONFIG.NFL.steamLineDiffMin ||
      priceDiff >= CONFIG.NFL.steamPriceDiffMin
    ) {
      alerts.push(
        buildSharpAlert({
          league: 'NFL',
          game,
          outcome: underdog,
          publicSide: null,
          dkOutcome,
          type: 'STEAM',
          reason:
            'Existe diferencia material entre la línea/precio de Pinnacle y DraftKings.',
        })
      )
    }
  }

  return alerts
}

function deduplicateAlerts(alerts) {
  const map = new Map()

  for (const alert of alerts) {
    const key = [
      alert.league,
      normalizeName(alert.game),
      normalizeName(alert.team),
      alert.type,
    ].join('|')

    if (!map.has(key)) {
      map.set(key, alert)
    }
  }

  return Array.from(map.values())
}

function sortAlerts(alerts) {
  return alerts.sort((a, b) => {
    const aScore =
      (a.divergence || 0) +
      (a.type === 'STEAM' ? 5 : 0)

    const bScore =
      (b.divergence || 0) +
      (b.type === 'STEAM' ? 5 : 0)

    return bScore - aScore
  })
}

function buildTelegramText(alerts) {
  let text = `🎯 *${alerts.length} SHARP / STEAM DETECTADOS*\n\n`

  for (const league of ['MLB', 'NFL']) {
    const leagueAlerts = alerts.filter(
      (alert) => alert.league === league
    )

    if (leagueAlerts.length === 0) {
      continue
    }

    text += `*${league}*\n\n`

    leagueAlerts.forEach((alert, index) => {
      text += `${index + 1}. *${alert.team}* ${alert.line}\n`
      text += `${alert.game}\n`

      if (
        isValidNumber(alert.tickets) &&
        isValidNumber(alert.money)
      ) {
        text += `📊 Tickets: ${alert.tickets}%\n`
        text += `💰 Dinero: ${alert.money}%\n`
        text += `📐 Divergencia: ${alert.divergence >= 0 ? '+' : ''}${alert.divergence} pts\n`
      }

      if (alert.isSteam) {
        text += `⚡ STEAM\n`
      } else {
        text += `🎯 SHARP\n`
      }

      text += `${alert.signal}\n\n`
    })
  }

  text += `🔗 https://tracke-sharp.vercel.app`

  return text
}

async function sendTelegram(alerts) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId || alerts.length === 0) {
    return {
      attempted: false,
      sent: false,
    }
  }

  const text = buildTelegramText(alerts)

  const params = new URLSearchParams({
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  })

  const response = await withTimeout(
    `https://api.telegram.org/bot${token}/sendMessage?${params.toString()}`
  )

  const data = await response.json()

  if (!response.ok || !data.ok) {
    throw new Error(
      data?.description ||
        `Telegram respondió ${response.status}`
    )
  }

  return {
    attempted: true,
    sent: true,
    messageId: data.result?.message_id || null,
  }
}

function getOrigin(req) {
  const protocol =
    req.headers['x-forwarded-proto'] ||
    'https'

  const host =
    req.headers['x-forwarded-host'] ||
    req.headers.host

  if (!host) {
    throw new Error('No fue posible determinar el host.')
  }

  return `${protocol}://${host}`
}

function isAuthorizedCron(req) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return false
  }

  const authorization = req.headers.authorization || ''

  return authorization === `Bearer ${cronSecret}`
}

export default async function handler(req, res) {
  /*
   * GET:
   * - permitido para Vercel Cron
   * - permitido para el frontend existente
   *
   * POST:
   * - también permitido para futuras actualizaciones
   *
   * No aceptamos otros métodos.
   */
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')

    return res.status(405).json({
      ok: false,
      error: 'Method Not Allowed',
    })
  }

  const apiKey = process.env.ODDS_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: 'Falta ODDS_API_KEY.',
    })
  }

  /*
   * Si existe CRON_SECRET, las llamadas que declaran
   * explícitamente el header de cron deben ser válidas.
   *
   * El frontend no necesita conocer el secreto.
   */
  if (
    req.headers['x-cron-request'] === 'true' &&
    !isAuthorizedCron(req)
  ) {
    return res.status(401).json({
      ok: false,
      error: 'Cron no autorizado.',
    })
  }

  const origin = getOrigin(req)

  const allAlerts = []
  const diagnostics = []

  try {
    for (const config of Object.values(CONFIG)) {
      try {
        const oddsResult = await getOdds(
          config.sportKey,
          config.market,
          apiKey
        )

        let publicResult = null

        try {
          publicResult = await getPublicBetting(
            origin,
            config.label
          )
        } catch (error) {
          diagnostics.push({
            league: config.label,
            publicBetting: 'unavailable',
            error: error.message,
          })
        }

        const publicGames =
          publicResult?.games || []

        /*
         * Ya no cortamos arbitrariamente a 16 partidos.
         *
         * La API devuelve los juegos disponibles y el motor
         * analiza todos los que tienen Pinnacle.
         */
        for (const game of oddsResult.games) {
          const publicGame = findPublicGame(
            publicGames,
            game
          )

          const alerts =
            config.label === 'MLB'
              ? evaluateMLB(game, publicGame)
              : evaluateNFL(game, publicGame)

          allAlerts.push(...alerts)
        }

        diagnostics.push({
          league: config.label,
          gamesReceived: oddsResult.games.length,
          publicGamesReceived: publicGames.length,
          oddsRemaining: oddsResult.remaining,
          oddsUsed: oddsResult.used,
        })
      } catch (error) {
        console.error(
          `Sharp engine ${config.label}:`,
          error
        )

        diagnostics.push({
          league: config.label,
          error: error.message,
        })
      }
    }

    const uniqueAlerts = deduplicateAlerts(
      allAlerts
    )

    const finalAlerts = sortAlerts(
      uniqueAlerts
    ).slice(0, 6)

    let telegram = {
      attempted: false,
      sent: false,
    }

    if (finalAlerts.length > 0) {
      try {
        telegram = await sendTelegram(
          finalAlerts
        )
      } catch (error) {
        console.error(
          'Telegram error:',
          error
        )

        telegram = {
          attempted: true,
          sent: false,
          error: error.message,
        }
      }
    }

    return res.status(200).json({
      ok: true,
      count: finalAlerts.length,
      alerts: finalAlerts,
      telegram,
      diagnostics,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error(
      'Sharp engine fatal error:',
      error
    )

    return res.status(500).json({
      ok: false,
      error: 'Error interno del Sharp Engine.',
    })
  }
}
