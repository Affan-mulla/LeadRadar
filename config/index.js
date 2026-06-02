// Centralized configuration for LeadRadar (env + constants).

const path = require('path')
const dotenv = require('dotenv')

dotenv.config()

const toNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false
  }

  return fallback
}

const rootDir = path.resolve(__dirname, '..')
const dataDir = path.join(rootDir, 'data')
const seenPostsPath = path.join(dataDir, 'seen_posts.json')

const config = {
  paths: {
    rootDir,
    dataDir,
    seenPostsPath,
  },
  scanning: {
    minIntentScore: toNumber(process.env.MIN_INTENT_SCORE, 4),
    maxPostAgeHours: toNumber(process.env.MAX_POST_AGE_HOURS, 48),
    scanIntervalHours: toNumber(process.env.SCAN_INTERVAL_HOURS, 2),
  },
  browser: {
    headless: toBoolean(process.env.HEADLESS, true),
  },
  reddit: {
    subreddits: [
      'saas',
      'entrepreneur',
      'smallbusiness',
      'agency',
      'freelance',
      'webdev',
      'automation',
      'nocode',
      'startups',
      'digital_marketing',
      'ppc',
      'seo',
      'ecommerce',
      'shopify',
      'aws',
      'dataengineering',
      'businessintelligence',
      'coldemail',
      'hiring',
    ],
    searchQueries: [
      'manually every week',
      'hours every week',
      'wish there was',
      'does anyone know a tool',
      'is there a tool that',
      'no good solution',
      'still using spreadsheets',
      'anyone built',
      'would pay for',
      'looking for a developer',
      'need someone to build',
      'how do you automate',
      'we do this manually',
      'pain in the ass',
      'so frustrating',
      'tried everything',
      'nobody has built this',
    ],
  },
  hackernews: {
    searchQueries: [
      'looking for developer',
      'need a developer',
      'willing to pay',
      'hire developer',
      'need someone to build',
    ],
  },
  scoring: {
    highIntentSignals: [
      'looking for developer',
      'would pay for',
      'hiring',
      'need someone to build',
      'willing to pay',
    ],
    mediumIntentSignals: [
      'wish there was a tool',
      'wish someone would build',
      'does anyone know a tool that',
      'is there a tool that',
      'is there anything that',
      'no good solution',
      'tried everything',
      'nothing works for this',
      'we do this manually',
      'doing this manually',
      'done manually',
      'still doing this by hand',
      'hours every week on this',
      'hours a week doing',
      'spend hours every',
      'wasting hours on',
      'nobody has built',
      'why does no tool',
      'why is there no',
      "can't find anything",
      'cant find anything',
      'still using spreadsheets for',
      'spreadsheet hell',
      'manually pull',
      'manually copy',
      'manually enter',
      'manually update',
      'manually export',
      'manually import',
    ],
    lowIntentSignals: [
      'anyone else',
      'is it just me',
      'would be nice if',
      'any tips',
      'any advice',
    ],
    negativeSignals: [
      'for hire',
      'just launched my',
      'just launched our',
      'we just launched',
      'i just launched',
      'check out my product',
      'check out our product',
      'shameless plug',
      'i built this tool',
      'we built this tool',
      'my tool does',
      'our tool does',
      'introducing my',
      'introducing our',
      'show hn:',
      'launch hn:',
      'producthunt.com',
      'product hunt launch',
      'feedback on my product',
      'feedback on our product',
      'roast my',
      'i solved this by building',
      'we solved this by building',
      'i wrote a script that',
      'we wrote a script that',
    ],
    intentRegex: {
      high: [],
      medium: [
        { label: 'time sink hours', pattern: /\b(spend|spending|spent|takes|taking)\s+\d+\s*(hours|hrs)\b/i },
        { label: 'manual reporting', pattern: /\bmanual(ly)?\b.*\breport/i },
        { label: 'manual workflow', pattern: /\bmanual(ly)?\b.*\bworkflow/i },
      ],
      low: [],
    },
    niches: {
      automation: [
        'automation',
        'automate',
        'workflow',
        'zapier',
        'integration',
      ],
      data: [
        'data',
        'dashboard',
        'reporting',
        'analytics',
        'csv',
      ],
      ai_integration: [
        'ai',
        'llm',
        'openai',
        'chatgpt',
        'claude',
      ],
      developer_tools: [
        'developer tool',
        'api',
        'sdk',
        'cli',
        'integration',
      ],
      hiring: [
        'hire',
        'recruiting',
        'talent',
        'freelancer',
        'contractor',
      ],
    },
  },
  notion: {
    token: process.env.NOTION_TOKEN || '',
    databaseId: process.env.NOTION_DATABASE_ID || '',
    properties: {
      name: 'Name',
      postId: 'Post ID',
      platform: 'Platform',
      score: 'Score',
      signalStrength: 'Signal Strength',
      niches: 'Niches',
      subreddit: 'Subreddit',
      url: 'URL',
      author: 'Author',
      postedAt: 'Posted At',
      status: 'Status',
    },
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  notifications: {
    maxSummaryLeads: 5,
  },
}

module.exports = config
