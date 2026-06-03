// AI-powered lead scoring using the Google GenAI SDK.

require('dotenv').config()
const { GoogleGenAI } = require('@google/genai')

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const SCORE_THRESHOLD = 4
const REQUEST_TIMEOUT_MS = 60000
const MAX_OUTPUT_TOKENS = 8192
const MAX_CANDIDATES_PER_GEMINI_CALL = Math.max(
  1,
  Number(process.env.GEMINI_BATCH_SIZE) || 25
)
const GEMINI_MIN_REQUEST_INTERVAL_MS = Math.max(
  0,
  Number(process.env.GEMINI_MIN_REQUEST_INTERVAL_MS) || 7000
)
const GEMINI_MAX_RETRIES = Math.max(0, Number(process.env.GEMINI_MAX_RETRIES) || 3)
const GEMINI_RETRY_BASE_DELAY_MS = Math.max(
  1000,
  Number(process.env.GEMINI_RETRY_BASE_DELAY_MS) || 15000
)
const DEV_LOG_SCORING_PIPELINE = process.env.DEV_LOG_SCORING_PIPELINE !== 'false'
const DISABLE_AI_SCORING_CALL = process.env.DISABLE_AI_SCORING_CALL !== 'false'
let geminiClient
let lastGeminiRequestAt = 0

const SYSTEM_PROMPT = `You are a lead filter for a freelance developer named Affan.
Affan builds websites, automations, internal tools, custom dashboards, and integrations for businesses.
He is looking for potential paying clients on Reddit.

Analyze the Reddit posts below and decide whether each person is a potential paying client for Affan.

A GOOD lead has ALL of these:
- A specific business or workflow problem that is costing them time or money
- Some signal they would pay for a technical solution, such as budget, asking for a developer, or strong frustration
- A business context, such as an agency, startup, small business, or team
- They are seeking help, not sharing their own solution

A BAD lead is ANY of these:
- Promoting or launching their own product, tool, or SaaS
- A student asking for homework help or tutorials
- General discussion or opinion with no problem to solve
- Person already solved their problem and is just sharing
- Someone looking for free advice, not willing to pay
- Completely off-topic, such as personal life, gaming, or fitness
- Job seeker looking for work; they want to be hired, not hire

CAPS:
- If there is business pain but no explicit budget, hiring intent, vendor search, or request for implementation help, cap the score at 5.
- If the post is a general survey, discussion prompt, or "how do you handle this" question, cap the score at 4 unless they clearly ask to hire someone.
- Do not infer willingness to pay from frustration alone.

SCORING GUIDE:
10 = Perfect lead. Explicit budget, looking for developer right now, specific problem
8-9 = Hot lead. Clear pain, strong buying signals, business context
6-7 = Good lead. Real problem, likely open to paying, worth reaching out
4-5 = Weak lead. Problem exists but buying intent is unclear
1-3 = Very weak. Possible problem but no real buying signal
0 = Not a lead at all

Return valid JSON only. No markdown, no prose, no partial JSON.
Keep each reason under 140 characters.
If unsure, omit the post from results instead of guessing.`

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    index: {
      type: 'integer',
      description: 'The index of the post from the input array.',
    },
    isLead: {
      type: 'boolean',
      description: 'True only when the post is worth saving as a potential paying client lead.',
    },
    score: {
      type: 'integer',
      minimum: 0,
      maximum: 10,
      description: 'Lead quality score from 0 to 10.',
    },
    reason: {
      type: 'string',
      maxLength: 160,
      description: 'One concise sentence explaining the lead decision.',
    },
    niche: {
      type: 'string',
      description: 'Best-fit niche, such as automation, dashboard, website, integration, ai, or other.',
    },
  },
  required: ['index', 'isLead', 'score', 'reason', 'niche'],
  additionalProperties: false,
}

const BATCH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      description: 'Only posts that are possible leads. Omit obvious non-leads.',
      items: SCORE_SCHEMA,
    },
  },
  required: ['results'],
  additionalProperties: false,
}

const OBVIOUS_NOISE_PATTERNS = [
  { reason: 'promotion_or_launch', pattern: /\b(i|we)\s+(launched|released)\b|\bjust\s+launched\b|\bcheck\s+(it|this|us)\s+out\b|\bwould\s+love\s+feedback\b|\bfree\s+trial\b|\bmy\s+(saas|app|tool|product)\b/i },
  { reason: 'job_seeker', pattern: /\b(hire\s+me|available\s+for\s+hire|looking\s+for\s+(work|a\s+job|job|internship)|seeking\s+(work|employment|job)|my\s+(portfolio|resume|cv))\b/i },
  { reason: 'student_or_learning', pattern: /\b(homework|assignment|school\s+project|college\s+project|student|beginner|tutorial|course|how\s+do\s+i\s+learn|learning\s+to)\b/i },
  { reason: 'free_advice_only', pattern: /\b(free\s+advice|just\s+curious|for\s+fun|side\s+project|hobby\s+project)\b/i },
  { reason: 'off_topic', pattern: /\b(gaming|fitness|dating|relationship|music\s+playlist|movie|anime)\b/i },
]

const BUYING_INTENT_PATTERNS = [
  /\b(looking\s+for|need|seeking|hire|hiring|pay|paid|budget|quote|proposal|contractor|freelancer|developer|agency|consultant)\b/i,
  /\b(dm\s+me|message\s+me|reach\s+out|available\s+budget|willing\s+to\s+pay)\b/i,
]

const PAIN_PATTERNS = [
  /\b(manual|manually|takes?\s+(too\s+)?long|wasting\s+time|hours?\s+(a|per|every)\s+(day|week|month)|frustrated|pain|bottleneck|struggling|problem|issue)\b/i,
  /\b(repetitive|tedious|broken|doesn'?t\s+work|can'?t\s+scale|inefficient|slow\s+process)\b/i,
]

const TECH_SOLUTION_PATTERNS = [
  /\b(automate|automation|dashboard|website|web\s+app|internal\s+tool|integration|api|script|scraper|crm|notion|airtable|zapier|make\.com|analytics|reporting|database)\b/i,
]

const BUSINESS_CONTEXT_PATTERNS = [
  /\b(agency|startup|company|business|client|customers|team|founder|owner|shopify|ecommerce|saas|sales|marketing|operations)\b/i,
]

const LEAD_RELEVANT_SUBREDDITS = new Set([
  'agency',
  'automation',
  'businessintelligence',
  'coldemail',
  'dataengineering',
  'digital_marketing',
  'ecommerce',
  'entrepreneur',
  'freelance',
  'hiring',
  'nocode',
  'ppc',
  'saas',
  'seo',
  'shopify',
  'smallbusiness',
  'startups',
  'webdev',
])

const hasPattern = (text, patterns) => patterns.some((pattern) => pattern.test(text))

const getPostText = (post) => `${post.title || ''}\n${post.body || ''}`.trim()

const getDefaultScoring = (reason) => ({
  score: 0,
  isLead: false,
  signals: [],
  niches: [],
  reason,
})

const getFilterDecision = (post) => {
  const text = getPostText(post)
  const subreddit = String(post.subreddit || '').toLowerCase()

  if (text.length < 25) {
    return { shouldScore: false, reason: 'too_short' }
  }

  for (const item of OBVIOUS_NOISE_PATTERNS) {
    if (item.pattern.test(text)) {
      return { shouldScore: false, reason: item.reason }
    }
  }

  const hasBuyingIntent = hasPattern(text, BUYING_INTENT_PATTERNS)
  const hasPain = hasPattern(text, PAIN_PATTERNS)
  const hasTechSolution = hasPattern(text, TECH_SOLUTION_PATTERNS)
  const hasBusinessContext =
    hasPattern(text, BUSINESS_CONTEXT_PATTERNS) || LEAD_RELEVANT_SUBREDDITS.has(subreddit)

  if (hasBuyingIntent || (hasPain && hasTechSolution) || (hasBusinessContext && (hasPain || hasTechSolution))) {
    return { shouldScore: true, reason: 'candidate' }
  }

  return { shouldScore: false, reason: 'no_obvious_lead_signal' }
}

const buildBatchContent = (posts) => {
  const compactPosts = posts.map(({ post, index }) => ({
    index,
    title: (post.title || '').slice(0, 180),
    body: (post.body || '').slice(0, 500),
    subreddit: post.subreddit || '',
  }))

  return [
    'Score the following candidate posts.',
    'Return results only for posts that are possible leads with score >= 4.',
    'Omit posts that are not possible leads.',
    `This chunk has ${posts.length} posts. Return no more than ${posts.length} results.`,
    JSON.stringify(compactPosts),
  ].join('\n\n')
}

const buildGeminiPrompt = (candidatePosts) => `${SYSTEM_PROMPT}\n\n${buildBatchContent(candidatePosts)}`

const logDevData = (label, data) => {
  if (!DEV_LOG_SCORING_PIPELINE) {
    return
  }

  console.log(`\n--- DEV SCORING LOG: ${label} ---`)
  if (typeof data === 'string') {
    console.log(data)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
  console.log(`--- END DEV SCORING LOG: ${label} ---\n`)
}

const parseGeminiJson = (raw) => {
  if (!raw) {
    throw new Error('Empty response from Gemini')
  }

  try {
    return JSON.parse(raw)
  } catch (_) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error(`No JSON found in Gemini response: ${raw}`)
    }
    return JSON.parse(jsonMatch[0])
  }
}

const normalizeScore = (value) => Math.min(Math.max(Number(value) || 0, 0), 10)

const normalizeAiResult = (parsed) => {
  const score = normalizeScore(parsed.score)
  const reason = parsed.reason || ''
  const niche = parsed.niche || 'other'

  return {
    score,
    isLead: Boolean(parsed.isLead) && score >= SCORE_THRESHOLD,
    signals: [reason || 'ai_scored'],
    niches: [niche],
    reason,
  }
}

const chunkArray = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getErrorStatus = (error) => (
  error?.status ||
  error?.code ||
  error?.response?.status ||
  error?.cause?.status ||
  error?.cause?.code
)

const getRetryAfterMs = (error) => {
  const headers =
    error?.response?.headers ||
    error?.headers ||
    error?.cause?.response?.headers
  const retryAfter =
    headers?.['retry-after'] ||
    headers?.get?.('retry-after')

  if (!retryAfter) {
    return 0
  }

  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000)
  }

  const dateMs = Date.parse(retryAfter)
  return Number.isNaN(dateMs) ? 0 : Math.max(0, dateMs - Date.now())
}

const isRateLimitError = (error) => {
  const rawStatus = getErrorStatus(error)
  const status = Number(rawStatus)
  const errorText = [
    rawStatus,
    error?.statusText,
    error?.message,
    error?.cause?.message,
  ].filter(Boolean).join(' ').toLowerCase()

  return (
    status === 429 ||
    errorText.includes('rate limit') ||
    errorText.includes('quota') ||
    errorText.includes('resource_exhausted') ||
    errorText.includes('too many requests')
  )
}

const getBackoffDelayMs = (attempt, error) => {
  const retryAfterMs = getRetryAfterMs(error)
  const exponentialDelay = GEMINI_RETRY_BASE_DELAY_MS * (2 ** attempt)
  const jitter = Math.floor(Math.random() * 1000)

  return Math.max(retryAfterMs, exponentialDelay + jitter)
}

const waitForGeminiSlot = async () => {
  const elapsedMs = Date.now() - lastGeminiRequestAt
  const waitMs = GEMINI_MIN_REQUEST_INTERVAL_MS - elapsedMs

  if (waitMs > 0) {
    console.log(`  Gemini rate limiter: waiting ${Math.ceil(waitMs / 1000)}s before next request`)
    await delay(waitMs)
  }

  lastGeminiRequestAt = Date.now()
}

const callGeminiWithRateLimit = async (requestFactory, label) => {
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    await waitForGeminiSlot()

    try {
      return await withTimeout(requestFactory(), REQUEST_TIMEOUT_MS)
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= GEMINI_MAX_RETRIES) {
        throw error
      }

      const backoffMs = getBackoffDelayMs(attempt, error)
      console.error(
        `  Gemini rate limit on ${label}. Retry ${attempt + 1}/${GEMINI_MAX_RETRIES} in ${Math.ceil(backoffMs / 1000)}s`
      )
      await delay(backoffMs)
    }
  }

  throw new Error(`Gemini request failed after ${GEMINI_MAX_RETRIES} retries`)
}

const getGeminiClient = (apiKey) => {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey })
  }
  return geminiClient
}

const withTimeout = async (promise, timeoutMs) => {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Gemini scoring timed out')), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

const markCandidatesWithReason = (scoredPosts, candidatePosts, reason) => {
  const candidateIndexes = new Set(candidatePosts.map((candidate) => candidate.index))
  return scoredPosts.map((post, index) => {
    if (!candidateIndexes.has(index)) {
      return post
    }
    return { ...post, ...getDefaultScoring(reason) }
  })
}

const applyGeminiResults = (scoredPosts, posts, candidatePosts, results) => {
  const candidateIndexes = new Set(candidatePosts.map((candidate) => candidate.index))

  for (const result of results) {
    const index = Number(result.index)
    if (!Number.isInteger(index) || !candidateIndexes.has(index)) {
      continue
    }

    const scoring = normalizeAiResult(result)
    scoredPosts[index] = {
      ...posts[index],
      ...scoring,
    }

    console.log(
      `  AI scored: "${(posts[index].title || '').slice(0, 50)}..." -> ${scoring.score}/10 | isLead: ${scoring.isLead} | ${scoring.reason}`
    )
  }
}

const scoreCandidateChunk = async (ai, posts, scoredPosts, candidateChunk, chunkIndex, totalChunks) => {
  const prompt = buildGeminiPrompt(candidateChunk)
  logDevData(`candidate chunk ${chunkIndex + 1}/${totalChunks}`, candidateChunk)
  logDevData(`full Gemini prompt chunk ${chunkIndex + 1}/${totalChunks}`, prompt)

  const response = await callGeminiWithRateLimit(
    () => ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseJsonSchema: BATCH_RESPONSE_SCHEMA,
      },
    }),
    `chunk ${chunkIndex + 1}/${totalChunks}`
  )

  const raw = response.text?.trim()
  const finishReason = response.candidates?.[0]?.finishReason || 'UNKNOWN'
  console.log(
    `  Gemini chunk ${chunkIndex + 1}/${totalChunks} received: finishReason=${finishReason}, chars=${raw?.length || 0}`
  )
  logDevData(`Gemini raw response chunk ${chunkIndex + 1}/${totalChunks}`, raw || '')

  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini response hit MAX_TOKENS before valid JSON finished')
  }

  const parsed = parseGeminiJson(raw)
  const results = Array.isArray(parsed.results) ? parsed.results : []
  applyGeminiResults(scoredPosts, posts, candidateChunk, results)
}

const scorePosts = async (posts) => {
  if (!Array.isArray(posts) || posts.length === 0) {
    return []
  }

  logDevData('scorePosts input', posts)

  const scoredPosts = posts.map((post) => ({
    ...post,
    ...getDefaultScoring('not_scored'),
  }))
  const candidatePosts = []

  posts.forEach((post, index) => {
    const decision = getFilterDecision(post)
    logDevData(`filter decision ${index}`, {
      index,
      postId: post.postId,
      title: post.title,
      subreddit: post.subreddit,
      decision,
    })

    if (decision.shouldScore) {
      candidatePosts.push({ post, index })
      return
    }

    scoredPosts[index] = {
      ...post,
      ...getDefaultScoring(decision.reason),
    }
  })

  console.log(
    `  Pre-AI filter: ${candidatePosts.length}/${posts.length} posts sent to Gemini`
  )

  if (candidatePosts.length === 0) {
    logDevData('scorePosts output without AI candidates', scoredPosts)
    return scoredPosts
  }

  logDevData('candidate posts sent to prompt builder', candidatePosts)

  if (DISABLE_AI_SCORING_CALL) {
    console.log('  DEV: Gemini scoring call disabled by DISABLE_AI_SCORING_CALL')
    const candidateChunks = chunkArray(candidatePosts, MAX_CANDIDATES_PER_GEMINI_CALL)
    candidateChunks.forEach((candidateChunk, chunkIndex) => {
      logDevData(
        `full Gemini prompt chunk ${chunkIndex + 1}/${candidateChunks.length}`,
        buildGeminiPrompt(candidateChunk)
      )
    })
    const devScoredPosts = markCandidatesWithReason(
      scoredPosts,
      candidatePosts,
      'ai_scoring_disabled'
    )
    logDevData('scorePosts output with AI disabled', devScoredPosts)
    return devScoredPosts
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in .env')
      return markCandidatesWithReason(scoredPosts, candidatePosts, 'no_api_key')
    }

    const ai = getGeminiClient(apiKey)
    const candidateChunks = chunkArray(candidatePosts, MAX_CANDIDATES_PER_GEMINI_CALL)
    console.log(
      `  Gemini scoring: ${candidatePosts.length} candidates across ${candidateChunks.length} request(s), batch size ${MAX_CANDIDATES_PER_GEMINI_CALL}, min interval ${GEMINI_MIN_REQUEST_INTERVAL_MS}ms`
    )

    for (const [chunkIndex, candidateChunk] of candidateChunks.entries()) {
      try {
        await scoreCandidateChunk(
          ai,
          posts,
          scoredPosts,
          candidateChunk,
          chunkIndex,
          candidateChunks.length
        )
      } catch (error) {
        console.error(
          `Gemini scoring chunk ${chunkIndex + 1}/${candidateChunks.length} failed:`,
          error.message
        )
        for (const candidate of candidateChunk) {
          scoredPosts[candidate.index] = {
            ...posts[candidate.index],
            ...getDefaultScoring('scoring_error'),
          }
        }
      }
    }

    return scoredPosts
  } catch (error) {
    console.error('Gemini scoring failed:', error.message)
    return markCandidatesWithReason(scoredPosts, candidatePosts, 'scoring_error')
  }
}

const scorePost = async (post) => {
  const [scoredPost] = await scorePosts([post])
  return {
    score: scoredPost?.score || 0,
    isLead: Boolean(scoredPost?.isLead),
    signals: scoredPost?.signals || [],
    niches: scoredPost?.niches || [],
    reason: scoredPost?.reason || 'scoring_error',
  }
}

module.exports = { scorePost, scorePosts }
