// Runs all scrapers and returns a combined list of posts.

const { runRedditScraper } = require('./reddit')

const runAllScrapers = async () => {
  try {
    const redditPosts = await runRedditScraper()
    return [...redditPosts]
  } catch (error) {
    console.error('❌ Scraper runner failed:', error.message)
    return []
  }
}

module.exports = { runAllScrapers }
