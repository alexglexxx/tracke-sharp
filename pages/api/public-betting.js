const ACTION_NETWORK_URLS = {
  mlb: [
    'https://api.actionnetwork.com/web/v1/scoreboard/mlb?period=game',
    'https://api.actionnetwork.com/web/v1/scoreboard/mlb',
  ],
  nfl: [
    'https://api.actionnetwork.com/web/v1/scoreboard/nfl?period=game',
    'https://api.actionnetwork.com/web/v1/scoreboard/nfl',
  ],
}

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

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function extractTeamInfo(team) {
  if (!team) {
    return null
  }

  const id =
    team.id ??
    team.team_id ??
    team.teamId ??
    team.uid ??
    null

  const name =
    team.display_name ??
    team.displayName ??
    team.full_name ??
    team.fullName ??
    team.name ??
    team.short_name ??
    team.shortName ??
    ''

  return {
    id: id !== null ? String(id) : null,
    name: String(name),
    normalizedName: normalizeName(name),
  }
}

/**
 * Action Network puede representar la información de apuestas
 * con estructuras diferentes según deporte/endpoint.
 *
 * Esta función intenta encontrar los porcentajes asociados
 * específicamente a un lado/equipo.
 */
function extractSideBetting(game, team) {
  if (!game || !team) {
    return null
  }

  const targetNames = new Set(
    [
      team.name,
      team.display_name,
      team.displayName,
      team.short_name,
      team.shortName,
      team.full_name,
      team.fullName,
    ]
      .filter(Boolean)
      .map(normalizeName)
  )

  const targetId = team.id ? String(team.id) : null

  const candidates = []

  function collect(value, inheritedTeam = null) {
    if (!value || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        collect(item, inheritedTeam)
      }
      return
    }

    const possibleTeam =
      value.team ??
      value.team_info ??
      value.teamInfo ??
      value.side ??
      value.selection ??
      value.participant ??
      inheritedTeam

    const possibleTeamInfo = extractTeamInfo(possibleTeam)

    const ownTeamName =
      value.team_name ??
      value.teamName ??
      value.name ??
      value.display_name ??
      value.displayName ??
      null

    const ownTeamNormalized = ownTeamName
      ? normalizeName(ownTeamName)
      : null

    const matchesTeam =
      (targetId &&
        possibleTeamInfo?.id &&
        possibleTeamInfo.id === targetId) ||
      (possibleTeamInfo?.normalizedName &&
        targetNames.has(possibleTeamInfo.normalizedName)) ||
      (ownTeamNormalized && targetNames.has(ownTeamNormalized))

    if (matchesTeam) {
      const tickets =
        numberOrNull(value.tickets_pct) ??
        numberOrNull(value.ticketsPct) ??
        numberOrNull(value.ticket_pct) ??
        numberOrNull(value.ticketPct) ??
        numberOrNull(value.bets_pct) ??
        numberOrNull(value.betsPct) ??
        numberOrNull(value.percent_bets) ??
        numberOrNull(value.percentBets)

      const money =
        numberOrNull(value.money_pct) ??
        numberOrNull(value.moneyPct) ??
        numberOrNull(value.money_percent) ??
        numberOrNull(value.moneyPercent) ??
        numberOrNull(value.percent_money) ??
        numberOrNull(value.percentMoney)

      if (tickets !== null || money !== null) {
        candidates.push({
          tickets,
          money,
        })
      }
    }

    for (const [key, nested] of Object.entries(value)) {
      if (
        key === 'team' ||
        key === 'team_info' ||
        key === 'teamInfo' ||
        key === 'side' ||
        key === 'selection' ||
        key === 'participant'
      ) {
        continue
      }

      if (nested && typeof nested === 'object') {
        collect(nested, possibleTeamInfo || inheritedTeam)
      }
    }
  }

  collect(game)

  return candidates[0] || null
}

/**
 * Fallback para estructuras donde Action Network expone
 * los lados explícitamente en arrays conocidas.
 */
function extractGameSides(game) {
  const sides = []

  const possibleArrays = [
    game.public_betting,
    game.publicBetting,
    game.betting,
    game.consensus,
    game.consensus_data,
    game.consensusData,
    game.sides,
    game.teams,
    game.outcomes,
  ]

  for (const collection of possibleArrays) {
    if (!Array.isArray(collection)) {
      continue
    }

    for (const item of collection) {
      if (!item || typeof item !== 'object') {
        continue
      }

      const team =
        item.team ??
        item.selection ??
        item.side ??
        item.participant ??
        item

      const teamInfo = extractTeamInfo(team)

      if (!teamInfo?.name) {
        continue
      }

      const tickets =
        numberOrNull(item.tickets_pct) ??
        numberOrNull(item.ticketsPct) ??
        numberOrNull(item.bets_pct) ??
        numberOrNull(item.betsPct) ??
        numberOrNull(item.percent_bets) ??
        numberOrNull(item.percentBets)

      const money =
        numberOrNull(item.money_pct) ??
        numberOrNull(item.moneyPct) ??
        numberOrNull(item.percent_money) ??
        numberOrNull(item.percentMoney)

      if (tickets === null && money === null) {
        continue
      }

      sides.push({
        team: teamInfo,
        tickets,
        money,
      })
    }
  }

  return sides
}

function parseGame(game) {
  const away =
    extractTeamInfo(game.away_team) ||
    extractTeamInfo(game.awayTeam) ||
    extractTeamInfo(game.teams?.away)

  const home =
    extractTeamInfo(game.home_team) ||
    extractTeamInfo(game.homeTeam) ||
    extractTeamInfo(game.teams?.home)

  if (!away?.name || !home?.name) {
    return null
  }

  const sides = extractGameSides(game)

  const sideData = {}

  for (const side of sides) {
    sideData[side.team.normalizedName] = {
      team: side.team.name,
      teamId: side.team.id,
      tickets: side.tickets,
      money: side.money,
    }
  }

  for (const team of [away, home]) {
    const extracted = extractSideBetting(game, team)

    if (extracted) {
      sideData[team.normalizedName] = {
        team: team.name,
        teamId: team.id,
        tickets: extracted.tickets,
        money: extracted.money,
      }
    }
  }

  return {
    matchup: `${away.name} @ ${home.name}`,
    away,
    home,
    sides: sideData,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({
      ok: false,
      error: 'Method Not Allowed',
    })
  }

  const league = String(req.query.league || 'mlb').toLowerCase()

  if (!['mlb', 'nfl'].includes(league)) {
    return res.status(400).json({
      ok: false,
      error: 'League inválida. Usa mlb o nfl.',
    })
  }

  const urls = ACTION_NETWORK_URLS[league]

  try {
    let responseData = null
    let sourceUrl = null

    for (const url of urls) {
      try {
        const response = await withTimeout(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://www.actionnetwork.com/',
          },
        })

        if (!response.ok) {
          continue
        }

        const json = await response.json()

        const games =
          json?.games ||
          json?.scoreboard?.games ||
          json?.data?.games ||
          []

        if (Array.isArray(games) && games.length > 0) {
          responseData = games
          sourceUrl = url
          break
        }
      } catch {
        // Intentamos el siguiente endpoint.
      }
    }

    if (!responseData) {
      return res.status(502).json({
        ok: false,
        source: 'action-network',
        league: league.toUpperCase(),
        error: 'No fue posible obtener datos públicos de Action Network.',
        games: [],
      })
    }

    const games = []

    for (const rawGame of responseData) {
      const parsed = parseGame(rawGame)

      if (!parsed) {
        continue
      }

      games.push(parsed)
    }

    return res.status(200).json({
      ok: true,
      source: 'action-network',
      league: league.toUpperCase(),
      sourceUrl,
      count: games.length,
      games,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('public-betting error:', error)

    return res.status(502).json({
      ok: false,
      source: 'action-network',
      league: league.toUpperCase(),
      error: 'Error obteniendo datos públicos.',
      games: [],
    })
  }
}
