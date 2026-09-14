import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { DeleteMarkdownSchema } from '@/lib/schemas'
import { deleteFile, readTextFile } from '@/lib/github'
import { invalidate } from '@/lib/cache'
import {
  CONTENT_DIR,
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
  NAV_JSON_PATH,
} from '@/lib/config'

export const runtime = 'nodejs'

// POST /api/content/delete — 删除一篇 markdown，并提示 nav.json 是否仍引用它
export async function POST(req: Request) {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await req.json().catch(() => null)
  const parsed = DeleteMarkdownSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const repoPath = `${CONTENT_DIR}/${parsed.data.mdPath}.md`
  const message = parsed.data.message ?? `Delete ${parsed.data.mdPath}.md`

  // 检查 nav.json 是否引用了这篇内容（只提示，不自动改）
  let referencedInNav = false
  const nav = await readTextFile({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: NAV_JSON_PATH,
    branch: CONTENT_REPO_BRANCH,
  })
  if (nav) {
    referencedInNav = nav.text.includes(`"${parsed.data.mdPath}"`)
  }

  const data = await deleteFile({ path: repoPath, message })
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  }

  invalidate(`public:md:${repoPath}`)

  return NextResponse.json({
    ok: true,
    mdPath: parsed.data.mdPath,
    referencedInNav,
    commit: (data as any)?.commit?.sha,
  })
}
