import { NextResponse } from 'next/server'
import { cached } from '@/lib/cache'
import { MdPathSchema } from '@/lib/schemas'
import { readTextFile } from '@/lib/github'
import { CONTENT_DIR, CONTENT_REPO_BRANCH, CONTENT_REPO_NAME, CONTENT_REPO_OWNER } from '@/lib/config'

export const runtime = 'nodejs'

const CACHE_TTL_MS = 60 * 1000

// GET /api/public/content?path=xxx — 公开只读单篇 markdown；1 分钟缓存
export async function GET(req: Request) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  const parsed = MdPathSchema.safeParse(path)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid path' }, { status: 400 })
  }

  const repoPath = `${CONTENT_DIR}/${parsed.data}.md`
  const file = await cached(`public:md:${repoPath}`, CACHE_TTL_MS, () =>
    readTextFile({
      owner: CONTENT_REPO_OWNER,
      repo: CONTENT_REPO_NAME,
      path: repoPath,
      branch: CONTENT_REPO_BRANCH,
    }),
  )

  if (!file) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  }

  return new Response(file.text, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=30',
    },
  })
}
