# LeadRadar

LeadRadar is a personal lead intelligence tool that scans Reddit and HackerNews for high-intent posts, scores them, saves qualified leads to Notion, and sends a Telegram summary. V1 is a simple, reliable workflow designed to save time and surface paying opportunities quickly.

## V1 build phases

1. Bootstrap and configuration
   - Centralize environment config
   - Define scoring signals and platform queries
   - Create dedup storage path
2. Dedup storage
   - Read/write seen post IDs from local JSON
   - Safe defaults and error handling
3. Scrapers
   - Reddit via Playwright
   - HackerNews via Algolia API
   - Normalize all posts to a shared format
4. Scoring
   - Keyword-based intent scoring
   - Niche tagging
5. Storage
   - Save qualified leads to Notion
   - Test connection helper
6. Notifications
   - Send one Telegram summary per scan
7. Orchestration
   - Scheduler with node-cron
   - End-to-end scan pipeline

## Data flow

Scrapers -> Scoring -> Dedup -> Notion -> Telegram

## Setup

1. Install dependencies
   - npm install
2. Create a local env file
   - copy .env.example to .env
3. Fill in your keys in .env
   - NOTION_TOKEN
   - NOTION_DATABASE_ID
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID

## Run

- Start once: npm start
- Dev mode: npm run dev

## Quick checks

- Score test: npm run test:score
- Notion connection: npm run test:notion
- Telegram message: npm run test:telegram
- Reddit scrape: npm run test:reddit

## Notion database schema

- Name (Title)
- Post ID (Text)
- Platform (Select) - Reddit or HackerNews
- Score (Number)
- Signal Strength (Select) - Hot / Strong / Possible
- Niches (Multi-select)
- Subreddit (Text)
- URL (URL)
- Author (Text)
- Posted At (Date)
- Status (Select) - New / Reviewing / Contacted / Not relevant

## Scoring signals

- High intent: looking for developer, would pay for, hiring, need someone to build, willing to pay
- Medium intent: wish there was, does anyone know a tool, we do this manually, hours every week, frustrated with
- Low intent: anyone else, is it just me, would be nice if
- Negative (drop): i built this, just launched, check out my product
- Niche bonus: automation, data, ai_integration, developer_tools, hiring
