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

    const highMatches = collectMatches(text, config.scoring.highIntentSignals)
    const mediumMatches = collectMatches(text, config.scoring.mediumIntentSignals)
    const lowMatches = collectMatches(text, config.scoring.lowIntentSignals)
    const nicheMatches = collectNiches(text)

    const rawScore =
      highMatches.length * 4 +
      mediumMatches.length * 2 +
      lowMatches.length * 1 +
      nicheMatches.length * 1

    const score = Math.min(rawScore, 10)
    const signals = Array.from(new Set([...highMatches, ...mediumMatches, ...lowMatches]))

    return {
      score,
      signals,
      niches: Array.from(new Set(nicheMatches)),
    }
  } catch (error) {
    console.error('❌ Scoring failed:', error.message)
    return { score: 0, signals: [], niches: [] }
  }
}

module.exports = { scorePost }
