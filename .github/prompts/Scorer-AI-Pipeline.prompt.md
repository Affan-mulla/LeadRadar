TASK: Replace the entire keyword-based scoring pipeline in LeadRadar 
with Google Gemini AI scoring.

---

CONTEXT:

LeadRadar is a personal lead intelligence tool that scans Reddit posts 
and saves potential freelance client leads to Notion. The current 
keyword-based scoring system is saving 99% noise because keywords 
cannot understand context. A post saying "I manually sort my music 
playlist every week" scores the same as "We need a developer to 
automate our weekly reporting process — budget available."

We are replacing keyword scoring with Google Gemini Flash API which 
is completely free at 1500 requests/day. No credit card needed.

---

FILES INVOLVED:

1. src/scoring/index.js         ← REPLACE ENTIRELY
2. config/index.js              ← REMOVE scoring section
3. .env.example                 ← ADD new variable
4. src/storage/notion.js        ← ADD isLead check
5. package.json                 ← NO CHANGES NEEDED (axios already there)

---

STEP 1: Replace src/scoring/index.js

Delete everything in this file and replace with this exact code:

```javascript
// AI-powered lead scoring using Google Gemini free API.
// Replaces keyword scoring — understands context not just words.
// Free tier: 1500 requests/day, no credit card required.
// Get key at: aistudio.google.com

const axios = require('axios')

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const SYSTEM_PROMPT = `You are a lead filter for a freelance developer named Affan.
Affan builds automations, internal tools, custom dashboards, and integrations for businesses.
He is looking for potential paying clients on Reddit.

Analyze the Reddit post below and decide: is this person a potential paying client for Affan?

A GOOD lead has ALL of these:
- A specific business or workflow problem that is costing them time or money
- Some signal they would pay for a technical solution (mentions budget, asks for developer, frustrated enough to pay)
- A business context (agency, startup, small business, team — not a student or hobbyist)
- They are seeking help — not sharing their own solution

A BAD lead is ANY of these:
- Promoting or launching their own product, tool, or SaaS
- A student asking for homework help or tutorials
- General discussion or opinion with no problem to solve
- Person already solved their problem and is just sharing
- Someone looking for free advice, not willing to pay
- Completely off-topic (personal life, gaming, fitness, etc.)
- Job seeker looking for work (they want to be hired, not hire)

SCORING GUIDE:
10 = Perfect lead. Explicit budget, looking for developer right now, specific problem
8-9 = Hot lead. Clear pain, strong buying signals, business context
6-7 = Good lead. Real problem, likely open to paying, worth reaching out
4-5 = Weak lead. Problem exists but buying intent is unclear
1-3 = Very weak. Possible problem but no real signal
0 = Not a lead at all

Respond with a single JSON object. No markdown. No explanation. No backticks. Just the raw JSON:
{"isLead":true,"score":8,"reason":"Agency owner spending 6 hours weekly on manual client reports, explicitly asking for developer help with budget","niche":"automation"}`

const scorePost = async (post) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY not set in .env')
      return { score: 0, isLead: false, signals: [], niches: [], reason: 'no_api_key' }
    }

    const postContent = [
      `Post Title: ${(post.title || '(no title)').slice(0, 300)}`,
      `Post Body: ${(post.body || '(no body)').slice(0, 800)}`,
      post.subreddit ? `Subreddit: r/${post.subreddit}` : '',
    ].filter(Boolean).join('\n\n')

    const response = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${postContent}` }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
          responseMimeType: 'application/json',
        }
      },
      { timeout: 15000 }
    )

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!raw) throw new Error('Empty response from Gemini')

    // Extract JSON safely even if model adds extra text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`No JSON found in: ${raw}`)

    const parsed = JSON.parse(jsonMatch[0])

    const score = Math.min(Math.max(Number(parsed.score) || 0, 0), 10)
    const isLead = Boolean(parsed.isLead) && score >= 4

    console.log(`  🤖 AI scored: "${(post.title || '').slice(0, 50)}..." → ${score}/10 | isLead: ${isLead} | ${parsed.reason || ''}`)

    return {
      score,
      isLead,
      signals: [parsed.reason || 'ai_scored'],
      niches: [parsed.niche || 'other'],
      reason: parsed.reason || ''
    }

  } catch (error) {
    console.error('❌ Gemini scoring failed:', error.message)
    return {
      score: 0,
      isLead: false,
      signals: [],
      niches: [],
      reason: 'scoring_error'
    }
  }
}

module.exports = { scorePost }
```

---

STEP 2: Clean up config/index.js

Find the entire scoring section in config/index.js. It looks like this:

```javascript
scoring: {
  highIntentSignals: [...],
  mediumIntentSignals: [...],
  lowIntentSignals: [...],
  negativeSignals: [...],
  intentRegex: {...},
  niches: {...},
},
```

Delete this entire scoring block. It is no longer needed.
The AI handles all of this now.

Keep everything else in config/index.js exactly as is.

---

STEP 3: Update .env.example

Add this line to .env.example:
GEMINI_API_KEY=your_gemini_api_key_here

Also add a comment above it:
Get free API key at: aistudio.google.com (no credit card needed, 1500 req/day free)
GEMINI_API_KEY=your_gemini_api_key_here

Tell the developer (Affan) to also add GEMINI_API_KEY to his actual .env file 
with his real key from aistudio.google.com

---

STEP 4: Update src/storage/notion.js

Find the function that decides whether to save a lead to Notion.
It currently checks only the score. Update it to also check isLead.

Find this pattern (or similar):
```javascript
if (scoring.score < config.scanning.minIntentScore) {
  return false
}
```

Replace with:
```javascript
if (!scoring.isLead || scoring.score < config.scanning.minIntentScore) {
  console.log(`  ⏭️  Skipped — isLead: ${scoring.isLead}, score: ${scoring.score}`)
  return false
}
```

This ensures a post must BOTH pass the AI judgment (isLead: true) AND 
meet the minimum score threshold to be saved. Double safety net.

---

STEP 5: Update .env (tell the developer)

After all code changes are done, remind the developer to:

1. Add GEMINI_API_KEY to their .env file
2. Get the key from aistudio.google.com (free, no card needed)
3. Lower MIN_INTENT_SCORE to 6 in .env since AI scoring is more accurate
   than keywords and we can trust higher scores more

---

VERIFICATION TEST:

After all changes, run this test to confirm everything works:

```javascript
node -e "
require('dotenv').config()
const { scorePost } = require('./src/scoring')

async function test() {
  console.log('Testing AI scoring...\n')

  const good = await scorePost({
    title: 'Looking for developer to automate our weekly client reports',
    body: 'We are a 8 person marketing agency. Every Friday we spend 5-6 hours manually pulling data from Google Ads, Facebook Ads, and Analytics into a spreadsheet for client reports. We tried Zapier but it does not support all our custom fields. Would pay $2000-3000 for the right solution. DM if interested.',
    subreddit: 'agency'
  })
  console.log('GOOD POST RESULT:')
  console.log(JSON.stringify(good, null, 2))
  console.log('Expected: isLead=true, score>=7\n')

  const bad = await scorePost({
    title: 'I built a tool that automates client reporting for agencies',
    body: 'Just launched my SaaS after 8 months of building. It connects to Google Analytics, Facebook Ads, and generates beautiful PDF reports automatically. Check it out at mysite.com. Would love feedback from agency owners. Free trial available.',
    subreddit: 'SaaS'
  })
  console.log('BAD POST RESULT:')
  console.log(JSON.stringify(bad, null, 2))
  console.log('Expected: isLead=false, score<=3\n')

  const borderline = await scorePost({
    title: 'How does your agency handle monthly client reporting?',
    body: 'We are still doing everything manually. Takes forever and our team hates it. Looking for a better way but not sure what options exist.',
    subreddit: 'agency'
  })
  console.log('BORDERLINE POST RESULT:')
  console.log(JSON.stringify(borderline, null, 2))
  console.log('Expected: isLead=true or false, score 4-6\n')
}

test().catch(console.error)
"
```

All three tests must run without errors before the task is complete.
Log results clearly so the developer can see what Gemini returned for each.

---

SUMMARY OF CHANGES:
- src/scoring/index.js → completely replaced with Gemini AI scoring
- config/index.js → scoring section removed (no longer needed)
- .env.example → GEMINI_API_KEY added
- src/storage/notion.js → isLead check added before saving
- .env → developer must add GEMINI_API_KEY manually

DO NOT change:
- src/scrapers/ (Reddit scraper stays the same)
- src/storage/dedup.js (dedup logic stays the same)
- src/notifications/telegram.js (notifications stay the same)
- src/browser/ (Playwright browser stays the same)
- index.js (scheduler stays the same)
- package.json (axios already installed)