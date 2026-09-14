import { NextResponse } from 'next/server'
import { cached } from '@/lib/cache'
import { readTextFile } from '@/lib/github'
import {
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
  NAV_JSON_PATH,
} from '@/lib/config'

export const runtime = 'nodejs'

const CACHE_TTL_MS = 5 * 60 * 1000

// GET /api/public/nav — 公开只读，无需登录；5 分钟服务端缓存
export async function GET() {
  const nav = await cached('public:nav', CACHE_TTL_MS, () =>
    readTextFile({
      owner: CONTENT_REPO_OWNER,
      repo: CONTENT_REPO_NAME,
      path: NAV_JSON_PATH,
      branch: CONTENT_REPO_BRANCH,
    }),
  )

  if (!nav) {
    return NextResponse.json({ ok: false, error: 'nav.json not found' }, { status: 404 })
  }

  return NextResponse.json(
    { ok: true, navJson: nav.text },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}
