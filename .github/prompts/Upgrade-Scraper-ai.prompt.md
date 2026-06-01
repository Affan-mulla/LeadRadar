# Prompt: Upgrade Scoring To AI (V2)

Use this when upgrading from keyword-based scoring to Claude AI scoring.

---

Upgrade src/scoring/index.js to use the Claude API instead of keyword matching.

Requirements:
- Keep the same function signature: scorePost(post) returns { score, signals, niches }
- Use @anthropic-ai/sdk for the API call
- Model: claude-haiku-3 (cheapest, fast enough)
- Prompt Claude to return JSON only

Prompt to use:
```
You are a lead scoring assistant for a freelance developer named Affan.
Score this post for buying intent on a scale of 0-10.

10 = Someone actively looking to hire a developer or pay for a solution right now
7-9 = Clear pain point with strong signals they would pay for help
4-6 = Genuine problem, might be open to paid solutions
1-3 = General complaint, unlikely to convert
0 = Self-promotion, product launch, or already solved

Also identify:
- niches: array of relevant categories from: ["automation", "data", "ai_integration", "developer_tools", "hiring"]
- reason: one sentence explaining the score

Post title: [TITLE]
Post body: [BODY]

Respond with valid JSON only, no other text:
{"score": number, "niches": string[], "reason": string}
```

Error handling:
- If API call fails: fall back to keyword scoring (import and call the old function)
- If JSON parse fails: return score of 0
- Log API errors but never throw

Add ANTHROPIC_API_KEY to .env.example after implementing.