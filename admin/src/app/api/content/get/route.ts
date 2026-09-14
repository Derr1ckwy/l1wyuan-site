import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { MdPathSchema } from '@/lib/schemas'
import { readTextFile } from '@/lib/github'
import {
  CONTENT_DIR,
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
} from '@/lib/config'

export const runtime = 'nodejs'

// GET /api/content/get?path=category/some-post — 读取单篇 markdown
export async function GET(req: Request) {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  const mdPath = new URL(req.url).searchParams.get('path')
  const parsed = MdPathSchema.safeParse(mdPath)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid path', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const file = await readTextFile({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: `${CONTENT_DIR}/${parsed.data}.md`,
    branch: CONTENT_REPO_BRANCH,
  })

  if (!file) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, mdPath: parsed.data, markdown: file.text, sha: file.sha })
}
