// Local JSON dedup storage for seen post IDs.

const fs = require('fs/promises')
const path = require('path')
const config = require('../../config')

const emptyData = { posts: [] }

const ensureSeenPostsFile = async () => {
  try {
    await fs.access(config.paths.seenPostsPath)
  } catch (error) {
    try {
      await fs.mkdir(config.paths.dataDir, { recursive: true })
      await fs.writeFile(
        config.paths.seenPostsPath,
        JSON.stringify(emptyData, null, 2),
        'utf-8'
      )
    } catch (writeError) {
      console.error('❌ Failed to create seen posts file:', writeError.message)
    }
  }
}

const readSeenPosts = async () => {
  try {
    await ensureSeenPostsFile()
    const raw = await fs.readFile(config.paths.seenPostsPath, 'utf-8')
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.posts)) {
      return { ...emptyData }
    }
    return data
  } catch (error) {
    console.error('❌ Failed to read seen posts:', error.message)
    return { ...emptyData }
  }
}

const writeSeenPosts = async (data) => {
  try {
    await fs.mkdir(config.paths.dataDir, { recursive: true })
    await fs.writeFile(
      config.paths.seenPostsPath,
      JSON.stringify(data, null, 2),
      'utf-8'
    )
  } catch (error) {
    console.error('❌ Failed to write seen posts:', error.message)
  }
}

const hasSeenPost = async (postId) => {
  const data = await readSeenPosts()
  return data.posts.includes(postId)
}

const addSeenPost = async (postId) => {
  const data = await readSeenPosts()
  if (!data.posts.includes(postId)) {
    data.posts.push(postId)
    await writeSeenPosts(data)
  }
}

const addSeenPosts = async (postIds) => {
  const data = await readSeenPosts()
  let changed = false

  for (const postId of postIds) {
    if (!data.posts.includes(postId)) {
      data.posts.push(postId)
      changed = true
    }
  }

  if (changed) {
    await writeSeenPosts(data)
  }
}

module.exports = {
  readSeenPosts,
  hasSeenPost,
  addSeenPost,
  addSeenPosts,
}
