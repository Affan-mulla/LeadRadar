// Reddit scraper using Playwright and JSON listing endpoints.

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

const mapJsonPosts = (children) => {
  if (!Array.isArray(children)) {
    return []
  }

  return children
    .map((child) => child && child.data)
    .filter(Boolean)
    .map((data) => {
      return {
        title: data.title || '',
        url: data.url || '',
        author: data.author || '',
        postId: data.name || data.id || '',
        subreddit: data.subreddit || '',
        postedAt: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : '',
        body: data.selftext || '',
        permalink: data.permalink || '',
      }
    })
}

const fetchListingJson = async (context, url) => {
  try {
    const response = await context.request.get(url, {
      headers: {
        accept: 'application/json,text/plain,*/*',
      },
    })

    if (!response.ok()) {
      console.error('❌ Reddit JSON request failed:', response.status())
      return []
    }

    const rawText = await response.text()
    if (!rawText) {
      return []
    }

    const trimmed = rawText.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      console.error('❌ Reddit JSON blocked or unexpected response.')
      return []
    }

    const parsed = JSON.parse(trimmed)
    return mapJsonPosts(parsed?.data?.children || [])
  } catch (error) {
    console.error('❌ Failed to fetch Reddit JSON:', error.message)
    return []
  }
}

const warmupSubreddit = async (page, subreddit) => {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/`
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(randomDelay())
  } catch (error) {
    console.error(`❌ r/${subreddit} warmup failed:`, error.message)
  }
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
      accept: 'application/json,text/plain,*/*',
      'accept-language': 'en-US,en;q=0.9',
    })
    page = await context.newPage()

    for (const subreddit of config.reddit.subreddits) {
      try {
        await warmupSubreddit(page, subreddit)
        const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=20&raw_json=1`
        const rawPosts = await fetchListingJson(context, url)
        results.push(...normalizePosts(rawPosts))
      } catch (error) {
        console.error(`❌ r/${subreddit} failed:`, error.message)
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
