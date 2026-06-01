# Prompt: Debug A Scraper

Use this when a scraper is returning 0 results or throwing errors.

---

The [PLATFORM] scraper in src/scrapers/[platform].js is not working.

Error / symptom: [DESCRIBE WHAT'S HAPPENING]

Debug steps to try in order:

1. Check if the platform changed their HTML structure
   - Open the URL in a real browser
   - Inspect the element we're trying to select
   - Update the selector if it changed

2. Check if we're being blocked
   - Look for 403, 429, or Cloudflare error pages
   - If blocked: add longer delays, randomize user agent, or add cookie handling

3. Check if the API changed (HackerNews only)
   - Visit https://hn.algolia.com/api/v1/search_by_date?query=test
   - Verify the response structure matches what we're parsing

4. Add debug logging temporarily:
   ```javascript
   const content = await page.content()
   console.log('PAGE CONTENT:', content.slice(0, 500))
   ```

5. Screenshot for visual debugging (Playwright):
   ```javascript
   await page.screenshot({ path: 'debug.png' })
   ```

Fix the issue and remove any debug logging before committing.