// Reddit scraper using Playwright and old.reddit.com for stable HTML.

const config = require('../../config')
const { getBrowser } = require('../browser')

const randomDelay = () => Math.floor(Math.random() * 2000) + 1000

const normalizeUrl = (url, permalink) => {
  if (permalink) {
    return `https://reddit.com${permalink}`
  }
  return url || ''
}

const isWithinMaxAge = (postedAt) => {
  if (!postedAt) {
    return true
  }

  const parsed = Date.parse(postedAt)
  if (Number.isNaN(parsed)) {
    return true
  }

  const ageMs = Date.now() - parsed
  const maxAgeMs = config.scanning.maxPostAgeHours * 60 * 60 * 1000
  return ageMs <= maxAgeMs
}

const normalizePosts = (rawPosts) => {
  return rawPosts
    .map((post) => {
      const url = normalizeUrl(post.url, post.permalink)
      const postedAt = post.postedAt ? new Date(post.postedAt).toISOString() : new Date().toISOString()

      return {
        platform: 'reddit',
        postId: post.postId || post.permalink || url,
        title: post.title || '',
        body: post.body || '',
        author: post.author || 'unknown',
        url,
        subreddit: post.subreddit || null,
        postedAt,
      }
    })
    .filter((post) => post.title && post.postId)
    .filter((post) => isWithinMaxAge(post.postedAt))
}

const fetchListing = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(randomDelay())

  try {
    await page.waitForSelector('.thing', { timeout: 10000 })
  } catch (error) {
    // If the selector is missing, still attempt to scrape whatever loaded.
  }

  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.thing'))
    return rows.map((row) => {
      const titleEl = row.querySelector('a.title')
      const authorEl = row.querySelector('a.author')
      const timeEl = row.querySelector('time')
      const bodyEl = row.querySelector('.usertext-body')

      return {
        title: titleEl ? titleEl.textContent.trim() : '',
        url: titleEl ? titleEl.href : row.getAttribute('data-url') || '',
        author: authorEl ? authorEl.textContent.trim() : '',
        postId: row.getAttribute('data-fullname') || '',
        subreddit: row.getAttribute('data-subreddit') || '',
        postedAt: timeEl ? timeEl.getAttribute('datetime') : '',
        body: bodyEl ? bodyEl.textContent.trim() : '',
        permalink: row.getAttribute('data-permalink') || '',
      }
    })
  })
}

const runRedditScraper = async () => {
  console.log('🔍 Starting Reddit scan...')

  const results = []
  let page = null
  let context = null

  try {
    const browser = await getBrowser()
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    })
    await context.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9',
    })
    page = await context.newPage()

    for (const subreddit of config.reddit.subreddits) {
      try {
        const url = `https://old.reddit.com/r/${subreddit}/new/`
        const rawPosts = await fetchListing(page, url)
        results.push(...normalizePosts(rawPosts))
      } catch (error) {
        console.error(`❌ r/${subreddit} failed:`, error.message)
      }
    }

    for (const subreddit of config.reddit.subreddits) {
      for (const query of config.reddit.searchQueries) {
        try {
          const url = `https://old.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(
            query
          )}&restrict_sr=1&sort=new`
          const rawPosts = await fetchListing(page, url)
          results.push(...normalizePosts(rawPosts))
        } catch (error) {
          console.error(`❌ r/${subreddit} search failed:`, error.message)
        }
      }
    }
  } catch (error) {
    console.error('❌ Reddit scraper failed:', error.message)
  } finally {
    if (page) {
      await page.close()
    }
    if (context) {
      await context.close()
    }
  }

  console.log('✅ Reddit scan complete:', results.length, 'posts')
  return results
}

module.exports = { runRedditScraper }
