// LeadRadar entry point and scheduler bootstrap.

const cron = require('node-cron')
const config = require('./config')
const { runAllScrapers } = require('./src/scrapers')
const { scorePost } = require('./src/scoring')
const { readSeenPosts, addSeenPosts } = require('./src/storage/dedup')
const { saveLeads } = require('./src/storage/notion')
const { sendLeadSummary } = require('./src/notifications/telegram')
const { closeBrowser } = require('./src/browser')

const buildPostKey = (post) => {
	const id = post.postId || post.url
	if (!post.platform || !id) {
		return ''
	}
	return `${post.platform}:${id}`
}

const scorePosts = (posts) => {
	return posts.map((post) => {
		const result = scorePost(post)
		return { ...post, ...result }
	})
}

const runScan = async () => {
	console.log('🔍 Starting scan...')

	try {
		const posts = await runAllScrapers()
		if (!posts.length) {
			console.log('✅ No posts found.')
			return
		}

		const seenData = await readSeenPosts()
		const seenSet = new Set(seenData.posts || [])
		const newPosts = []
		const allKeys = []

		for (const post of posts) {
			const key = buildPostKey(post)
			if (!key) {
				continue
			}

			allKeys.push(key)

			if (!seenSet.has(key)) {
				newPosts.push(post)
			}
		}

		if (!newPosts.length) {
			console.log('✅ No new posts after dedup.')
			await addSeenPosts(allKeys)
			return
		}

		const scoredPosts = scorePosts(newPosts)
		const qualified = scoredPosts.filter(
			(post) => post.score >= config.scanning.minIntentScore
		)

		await saveLeads(qualified)
		await sendLeadSummary(qualified)
		await addSeenPosts(allKeys)

		console.log('✅ Scan complete:', qualified.length, 'qualified leads')
	} catch (error) {
		console.error('❌ Scan failed:', error.message)
	}
}

const scheduleScans = () => {
	const interval = Math.max(1, Math.floor(config.scanning.scanIntervalHours))
	const expression = `0 */${interval} * * *`

	cron.schedule(expression, () => {
		runScan()
	})

	console.log('✅ Scheduler ready:', `every ${interval} hour(s)`) 
}

const main = async () => {
	try {
		console.log(
			'🔍 LeadRadar starting with scan interval:',
			config.scanning.scanIntervalHours,
			'hours'
		)
		await runScan()
		scheduleScans()
	} catch (error) {
		console.error('❌ Startup failed:', error.message)
	}
}

process.on('SIGINT', async () => {
	await closeBrowser()
	process.exit(0)
})

process.on('SIGTERM', async () => {
	await closeBrowser()
	process.exit(0)
})

main()
