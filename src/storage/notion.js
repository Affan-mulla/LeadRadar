// Notion storage helpers for saving qualified leads.

const { Client } = require('@notionhq/client')
const config = require('../../config')

const getNotionClient = () => {
  if (!config.notion.token || !config.notion.databaseId) {
    console.error('❌ Notion config missing. Check NOTION_TOKEN and NOTION_DATABASE_ID.')
    return null
  }

  return new Client({ auth: config.notion.token })
}

const formatPlatform = (platform) => {
  if (platform === 'reddit') {
    return '🟠 Reddit'
  }
  if (platform === 'hackernews') {
    return '🟡 HackerNews'
  }
  return platform || 'Unknown'
}

const formatSignalStrength = (score) => {
  if (score >= 8) {
    return '🔥 Hot'
  }
  if (score >= 6) {
    return '⚡ Strong'
  }
  return '👀 Possible'
}

const buildRichText = (value) => {
  if (!value) {
    return []
  }

  return [{ type: 'text', text: { content: value } }]
}

const buildTitle = (value) => {
  if (!value) {
    return []
  }

  return [{ type: 'text', text: { content: value } }]
}

const buildNotionProperties = (lead) => {
  const parsedDate = Date.parse(lead.postedAt)
  const postedAt = Number.isNaN(parsedDate) ? null : lead.postedAt

  const properties = {
    Name: { title: buildTitle(lead.title || 'Untitled lead') },
    'Post ID': { rich_text: buildRichText(`${lead.platform}:${lead.postId}`) },
    Platform: { select: { name: formatPlatform(lead.platform) } },
    Score: { number: lead.score || 0 },
    'Signal Strength': { select: { name: formatSignalStrength(lead.score || 0) } },
    Niches: { multi_select: (lead.niches || []).map((niche) => ({ name: niche })) },
    Subreddit: { rich_text: buildRichText(lead.subreddit || '') },
    URL: { url: lead.url || '' },
    Author: { rich_text: buildRichText(lead.author || '') },
    Status: { select: { name: '🆕 New' } },
  }

  if (postedAt) {
    properties['Posted At'] = { date: { start: postedAt } }
  }

  return properties
}

const saveLead = async (client, lead) => {
  try {
    await client.pages.create({
      parent: { database_id: config.notion.databaseId },
      properties: buildNotionProperties(lead),
    })
    return true
  } catch (error) {
    console.error('❌ Failed to save lead to Notion:', error.message)
    return false
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const randomDelay = () => Math.floor(Math.random() * 2000) + 1000

const saveLeads = async (leads) => {
  if (!leads || leads.length === 0) {
    console.log('✅ No qualified leads to save.')
    return 0
  }

  const client = getNotionClient()
  if (!client) {
    return 0
  }

  let saved = 0
  for (const lead of leads) {
    const ok = await saveLead(client, lead)
    if (ok) {
      saved += 1
    }
    await delay(randomDelay())
  }

  console.log('💾 Saved leads to Notion:', saved)
  return saved
}

const testConnection = async () => {
  const client = getNotionClient()
  if (!client) {
    return false
  }

  try {
    await client.databases.retrieve({ database_id: config.notion.databaseId })
    console.log('✅ Notion connection OK')
    return true
  } catch (error) {
    console.error('❌ Notion connection failed:', error.message)
    return false
  }
}

module.exports = {
  saveLeads,
  testConnection,
}
