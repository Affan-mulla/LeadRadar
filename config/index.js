// Centralized configuration for LeadRadar (env + constants).

const path = require('path')
const dotenv = require('dotenv')

dotenv.config()

const toNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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
      'wish there was',
      'does anyone know a tool',
      'we do this manually',
      'hours every week',
      'frustrated with',
    ],
    lowIntentSignals: [
      'anyone else',
      'is it just me',
      'would be nice if',
    ],
    negativeSignals: [
      'i built this',
      'just launched',
      'check out my product',
    ],
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
