import fs from 'node:fs/promises'
import path from 'node:path'

async function main() {
  const root = process.cwd()

  const owner = process.env.CONTENT_REPO_OWNER
  const repo = process.env.CONTENT_REPO_NAME
  const branch = process.env.CONTENT_REPO_BRANCH || 'main'
  const token = process.env.GITHUB_CONTENT_TOKEN

  if (!owner || !repo || !token) {
    throw new Error('Missing env: CONTENT_REPO_OWNER, CONTENT_REPO_NAME, GITHUB_CONTENT_TOKEN')
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const api = async (url: string) => {
    const res = await fetch(url, { headers: authHeaders })
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${url}`)
    }
    return res.json() as Promise<any>
  }

  const generatedDir = path.join(root, 'src', 'generated')
  await fs.mkdir(generatedDir, { recursive: true })

  // 1. nav.json -> src/generated/nav.json
  const navData = await api(
    `https://api.github.com/repos/${owner}/${repo}/contents/nav.json?ref=${branch}`,
  )
  const navText = Buffer.from(navData.content, 'base64').toString('utf8')
  await fs.writeFile(path.join(generatedDir, 'nav.json'), navText, 'utf8')
  console.log('Synced nav.json -> src/generated/nav.json')

  // 2. all content/*.md -> public/content
  const tree = await api(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
  )
  const mdFiles: string[] = (tree.tree ?? [])
    .filter((entry: any) => entry.type === 'blob' && entry.path.startsWith('content/'))
    .filter((entry: any) => entry.path.endsWith('.md'))
    .map((entry: any) => entry.path)

  let synced = 0
  for (const filePath of mdFiles) {
    const data = await api(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
    )
    const text = Buffer.from(data.content, 'base64').toString('utf8')
    const outPath = path.join(root, 'public', filePath)
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, text, 'utf8')
    synced++
  }
  console.log(`Synced ${synced} markdown files -> public/content`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
