# Prompt: Build A New Scraper

Use this prompt when adding a new platform scraper to LeadRadar.

---

Build a scraper for [PLATFORM_NAME] in src/scrapers/[platform].js

Requirements:
- Use Playwright browser from src/browser/index.js (import getBrowser)
- Add random delay of 1000-3000ms between page navigations
- Return array of standard Post objects (see format below)
- Wrap everything in try/catch — errors should be logged not thrown
- Add console.log with 🔍 prefix when starting scan
- Add console.log with ✅ prefix when done, showing count found

Standard Post Object:
```javascript
{
  platform: 'string',     // platform name lowercase
  postId: 'string',       // unique ID from platform
  title: 'string',        // post title
  body: 'string',         // post content (empty string if none)
  author: 'string',       // username
  url: 'string',          // direct URL
  subreddit: null,        // null for non-Reddit platforms
  postedAt: 'string',     // ISO 8601 timestamp
}
```

Export a single function:
```javascript
async function run[PlatformName]Scraper() {
  // returns Post[]
}
module.exports = { run[PlatformName]Scraper }
```

After creating the file, add it to src/scrapers/index.js