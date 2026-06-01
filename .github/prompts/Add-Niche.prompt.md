# Prompt: Add A New Niche

Use this when you want LeadRadar to start tracking a new type of problem.

---

Add a new niche called "[NICHE_NAME]" to LeadRadar.

Steps:

1. Open config/index.js
2. Find the niches object
3. Add new entry:
```javascript
[niche_name]: [
  'keyword1',
  'keyword2',
  'keyword3',
  // add 8-15 relevant keywords that people use when talking about this problem
]
```

4. Open src/scoring/index.js
5. Verify the niche bonus logic picks up the new niche automatically
   (it should — it loops over all keys in config.niches)

6. Test by running:
```javascript
const { scorePost } = require('./src/scoring')
console.log(scorePost({ 
  title: 'Post about [niche topic]', 
  body: 'Contains [keyword1] and [keyword2]' 
}))
// Should show new niche in niches array
```

Good niches to consider adding:
- ecommerce (Shopify, WooCommerce, inventory, orders)
- hr_recruiting (hiring, candidates, ATS, onboarding)
- finance (invoicing, billing, accounting, bookkeeping)
- content_creation (social media, scheduling, posting)
- customer_support (tickets, helpdesk, support emails)