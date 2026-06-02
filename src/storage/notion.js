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
  const names = config.notion.properties || {}

  const addProperty = (properties, name, value) => {
    if (!name) {
      return
    }
    properties[name] = value
  }

  const properties = {}

  addProperty(properties, names.name, { title: buildTitle(lead.title || 'Untitled lead') })
  addProperty(
    properties,
    names.postId,
    { rich_text: buildRichText(`${lead.platform}:${lead.postId}`) }
  )
  addProperty(properties, names.platform, { select: { name: formatPlatform(lead.platform) } })
  addProperty(properties, names.score, { number: lead.score || 0 })
  addProperty(properties, names.signalStrength, {
    select: { name: formatSignalStrength(lead.score || 0) },
  })
  addProperty(properties, names.niches, {
    multi_select: (lead.niches || []).map((niche) => ({ name: niche })),
  })
  addProperty(properties, names.subreddit, { rich_text: buildRichText(lead.subreddit || '') })
  addProperty(properties, names.url, { url: lead.url || '' })
  addProperty(properties, names.author, { rich_text: buildRichText(lead.author || '') })
  addProperty(properties, names.status, { status: { name: 'New' } })

  if (postedAt) {
    addProperty(properties, names.postedAt, { date: { start: postedAt } })
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
