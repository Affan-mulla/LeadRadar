// Telegram notification helpers for LeadRadar scan summaries.

const TelegramBot = require('node-telegram-bot-api')
const config = require('../../config')

let botInstance = null

const getBot = () => {
  if (!config.telegram.botToken || !config.telegram.chatId) {
    console.error('❌ Telegram config missing. Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.')
    return null
  }

  if (!botInstance) {
    botInstance = new TelegramBot(config.telegram.botToken, { polling: false })
  }

  return botInstance
}

const formatLeadLine = (lead, index) => {
  const title = (lead.title || '').replace(/\s+/g, ' ').trim()
  const platform = lead.platform === 'reddit' ? 'Reddit' : 'HackerNews'
  const score = lead.score ?? 0

  return `${index + 1}. (${score}) [${platform}] ${title}\n${lead.url}`
}

const formatLeadSummary = (leads) => {
  if (!leads.length) {
    return '✅ LeadRadar scan complete. No qualified leads this run.'
  }

  const limit = config.notifications.maxSummaryLeads
  const sorted = [...leads].sort((a, b) => (b.score || 0) - (a.score || 0))
  const topLeads = sorted.slice(0, limit)

  const lines = [`✅ LeadRadar found ${leads.length} qualified lead(s)`]
  lines.push('')

  topLeads.forEach((lead, index) => {
    lines.push(formatLeadLine(lead, index))
    lines.push('')
  })

  if (leads.length > topLeads.length) {
    lines.push(`...and ${leads.length - topLeads.length} more`)
  }

  return lines.join('\n')
}

const sendMessage = async (message) => {
  const bot = getBot()
  if (!bot) {
    return false
  }

  try {
    await bot.sendMessage(config.telegram.chatId, message, { disable_web_page_preview: true })
    console.log('📱 Telegram message sent')
    return true
  } catch (error) {
    console.error('❌ Telegram send failed:', error.message)
    return false
  }
}

const sendLeadSummary = async (leads) => {
  if (!leads || leads.length === 0) {
    console.log('✅ No qualified leads to notify.')
    return false
  }

  const message = formatLeadSummary(leads)
  return sendMessage(message)
}

module.exports = {
  sendMessage,
  sendLeadSummary,
}
