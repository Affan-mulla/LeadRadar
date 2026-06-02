// Playwright browser manager (singleton) for all scrapers.

const { chromium } = require('playwright')
const config = require('../../config')

let browserInstance = null

const getBrowser = async () => {
  if (browserInstance) {
    return browserInstance
  }

  try {
    browserInstance = await chromium.launch({ headless: config.browser.headless })
    return browserInstance
  } catch (error) {
    console.error('❌ Failed to launch browser:', error.message)
    throw error
  }
}

const closeBrowser = async () => {
  if (!browserInstance) {
    return
  }

  try {
    await browserInstance.close()
  } catch (error) {
    console.error('❌ Failed to close browser:', error.message)
  } finally {
    browserInstance = null
  }
}

module.exports = {
  getBrowser,
  closeBrowser,
}
