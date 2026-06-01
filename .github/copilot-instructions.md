# LeadRadar — Copilot Instructions

## What This Project Is

LeadRadar is a personal lead intelligence tool for a freelance developer. It monitors Reddit and HackerNews for posts where people are actively looking to hire a developer, complaining about manual work, or asking if a tool exists. When it finds a high-intent post it saves it to Notion and sends a Telegram summary notification.

This is NOT a SaaS. NOT a product with user accounts. It is a personal tool built for one developer to find freelance clients faster.

## The Developer

- Name: Affan
- Stack comfort: React, Next.js, Node.js, TypeScript, Tailwind, Framer Motion
- Experience level: Intermediate — knows the basics, can learn new things fast
- Goal: Find freelance clients by monitoring online communities for buying signals

## Core Philosophy

- Simple over clever
- Working over perfect
- Personal tool first, sellable product later
- No unnecessary dependencies
- No external databases — use local JSON for dedup, Notion for lead storage

## Tech Stack (Do Not Change Without Reason)

- **Runtime:** Node.js
- **Language:** JavaScript (not TypeScript for this project — keep it simple)
- **Browser automation:** Playwright (scrapes Reddit like a real browser)
- **HackerNews:** Algolia public API (no browser needed, never blocks)
- **Dedup:** Local JSON file (seen_posts.json)
- **Lead storage:** Notion API (@notionhq/client version 2.2.15)
- **Notifications:** Telegram Bot API (node-telegram-bot-api)
- **Scheduling:** node-cron
- **Config:** dotenv

## Project Structure (Strict — Do Not Deviate)

```
leadradar/
├── .github/
│   ├── copilot-instructions.md   ← this file
│   ├── agents/                   ← agent role files
│   └── prompts/                  ← reusable prompt files
├── config/
│   └── index.js                  ← all config in one place
├── src/
│   ├── browser/
│   │   └── index.js              ← Playwright browser manager (singleton)
│   ├── scrapers/
│   │   ├── reddit.js             ← Reddit scraper using Playwright
│   │   ├── hackernews.js         ← HN scraper using Algolia API
│   │   └── index.js              ← runs all scrapers, returns combined array
│   ├── scoring/
│   │   └── index.js              ← keyword-based intent scoring
│   ├── storage/
│   │   ├── notion.js             ← saves leads to Notion database
│   │   └── dedup.js              ← read/write seen_posts.json
│   └── notifications/
│       └── telegram.js           ← sends Telegram summary
├── data/
│   └── seen_posts.json           ← auto-created, stores seen post IDs
├── index.js                      ← entry point, scheduler lives here
├── .env                          ← never commit this
├── .env.example                  ← commit this
├── .gitignore
└── package.json
```

## Version Roadmap

### V1 (Current) — Personal Tool
- Reddit + HackerNews scraping
- Keyword-based intent scoring
- Notion lead storage
- Telegram summary notification
- Local JSON dedup
- Runs on cron every 2 hours

### V2 (Future) — More Platforms
- Add Twitter/X, Indie Hackers
- Replace keyword scoring with Claude API scoring
- Smarter dedup across platforms

### V3 (Future) — Sellable
- Simple web dashboard
- User can configure keywords
- Proxy rotation for scaling

## Coding Rules

1. Every function must have a clear single responsibility
2. Every file must have a comment at the top explaining what it does
3. Use async/await everywhere — no callbacks, no .then() chains
4. All errors must be caught and logged — never let the process crash
5. Use console.log with emoji prefixes for clarity:
   - 🔍 for scanning
   - ✅ for success
   - ❌ for errors
   - 📱 for notifications
   - 💾 for storage
6. Add small random delays between requests (1000-3000ms) to avoid rate limiting
7. Never hardcode values — everything configurable through config/index.js

## Environment Variables

```
NOTION_TOKEN=
NOTION_DATABASE_ID=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
MIN_INTENT_SCORE=4
MAX_POST_AGE_HOURS=48
SCAN_INTERVAL_HOURS=2
```

## Notion Database Schema

The Notion database must have these exact columns:
- Name (Title) — post title
- Post ID (Text) — platform:postId for dedup
- Platform (Select) — 🟠 Reddit or 🟡 HackerNews
- Score (Number) — intent score 0-10
- Signal Strength (Select) — 🔥 Hot / ⚡ Strong / 👀 Possible
- Niches (Multi-select) — matched niche categories
- Subreddit (Text) — subreddit name if Reddit
- URL (URL) — direct link to post
- Author (Text) — post author username
- Posted At (Date) — when post was published
- Status (Select) — 🆕 New / 👀 Reviewing / ✅ Contacted / ❌ Not relevant

## Intent Scoring Logic

Score is calculated by matching post text against signal patterns:

- High intent signals (weight 4): "looking for developer", "would pay for", "hiring", "need someone to build", "willing to pay"
- Medium intent signals (weight 2): "wish there was", "does anyone know a tool", "we do this manually", "hours every week", "frustrated with"
- Low intent signals (weight 1): "anyone else", "is it just me", "would be nice if"
- Negative signals (weight -10, returns -1 immediately): "i built this", "just launched", "check out my product"
- Niche bonus (+1 per matched niche): automation, data, ai_integration, developer_tools, hiring

Only posts with score >= MIN_INTENT_SCORE get saved.

## Anti-Blocking Strategy

Reddit blocks plain HTTP requests. Playwright solves this by running a real Chrome browser.

Key practices:
- Random delays between page loads (1-3 seconds)
- Realistic browser user agent (set automatically by Playwright)
- Reuse one browser instance across all Reddit scraping (don't open/close per request)
- If a page fails, log the error and continue — never crash the whole scan