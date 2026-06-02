// Keyword-based intent scoring for LeadRadar posts.

const config = require('../../config')

const normalizeText = (text) => (text || '').toLowerCase()

const collectMatches = (text, signals) => {
  const matches = []
  for (const signal of signals) {
    if (text.includes(signal.toLowerCase())) {
      matches.push(signal)
    }
  }
  return matches
}

const collectRegexMatches = (text, entries = []) => {
  const matches = []
  for (const entry of entries) {
    const pattern = entry.pattern || entry
    const label = entry.label || pattern.source
    if (pattern && pattern.global) {
      pattern.lastIndex = 0
    }
    if (pattern && pattern.test(text)) {
      matches.push(label)
    }
  }
  return matches
}

const collectNiches = (text) => {
  const matches = []
  const entries = Object.entries(config.scoring.niches)

  for (const [niche, keywords] of entries) {
    const hit = keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    if (hit) {
      matches.push(niche)
    }
  }

  return matches
}

const scorePost = (post) => {
  try {
    const text = normalizeText(`${post.title || ''} ${post.body || ''}`)

    const negativeMatches = collectMatches(text, config.scoring.negativeSignals)
    if (negativeMatches.length > 0) {
      return {
        score: -1,
        signals: Array.from(new Set(negativeMatches)),
        niches: [],
      }
    }

    const hasHighSignal = collectMatches(text, config.scoring.highIntentSignals).length > 0
    const hasMediumSignal = collectMatches(text, config.scoring.mediumIntentSignals).length > 0
    const hasHighRegex = collectRegexMatches(text, config.scoring.intentRegex?.high).length > 0
    const hasMediumRegex = collectRegexMatches(text, config.scoring.intentRegex?.medium).length > 0

    if (!hasHighSignal && !hasMediumSignal && !hasHighRegex && !hasMediumRegex) {
      return {
        score: 0,
        signals: [],
        niches: [],
        isLead: false,
        reason: 'only_low_signals',
      }
    }

    const highMatches = collectMatches(text, config.scoring.highIntentSignals)
    const mediumMatches = collectMatches(text, config.scoring.mediumIntentSignals)
    const lowMatches = collectMatches(text, config.scoring.lowIntentSignals)
    const highRegexMatches = collectRegexMatches(text, config.scoring.intentRegex?.high)
    const mediumRegexMatches = collectRegexMatches(text, config.scoring.intentRegex?.medium)
    const lowRegexMatches = collectRegexMatches(text, config.scoring.intentRegex?.low)
    const nicheMatches = collectNiches(text)

    const rawScore =
      (highMatches.length + highRegexMatches.length) * 4 +
      (mediumMatches.length + mediumRegexMatches.length) * 2 +
      (lowMatches.length + lowRegexMatches.length) * 1 +
      nicheMatches.length * 1

    const score = Math.min(rawScore, 10)
    const intentCount =
      highMatches.length +
      mediumMatches.length +
      highRegexMatches.length +
      mediumRegexMatches.length
    const signals = Array.from(
      new Set([
        ...highMatches,
        ...mediumMatches,
        ...lowMatches,
        ...highRegexMatches,
        ...mediumRegexMatches,
        ...lowRegexMatches,
      ])
    )

    if (intentCount === 0) {
      return {
        score: 0,
        signals,
        niches: Array.from(new Set(nicheMatches)),
        isLead: false,
        reason: 'no_intent_signal',
      }
    }

    return {
      score,
      signals,
      niches: Array.from(new Set(nicheMatches)),
      isLead: true,
      reason: 'intent_signal',
    }
  } catch (error) {
    console.error('❌ Scoring failed:', error.message)
    return { score: 0, signals: [], niches: [], isLead: false, reason: 'error' }
  }
}

module.exports = { scorePost }
