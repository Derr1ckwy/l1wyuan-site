import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { UpsertMarkdownSchema } from '@/lib/schemas'
import { upsertTextFile } from '@/lib/github'
import { invalidate } from '@/lib/cache'
import { CONTENT_DIR } from '@/lib/config'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await req.json().catch(() => null)
  const parsed = UpsertMarkdownSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const message =
    parsed.data.message ?? `Update ${parsed.data.mdPath}.md (${new Date().toISOString()})`

  const path = `${CONTENT_DIR}/${parsed.data.mdPath}.md`

  const data = await upsertTextFile({
    path,
    contentText: parsed.data.markdown,
    message,
  })

  // 写后立即失效公开读缓存，保证保存-刷新闭环
  invalidate(`public:md:${path}`)

  // Helps diagnose repo/path/branch mismatches quickly.
  console.log('[upsertMarkdown]', {
    path,
    commit: (data as any)?.commit?.sha,
  })

  return NextResponse.json({ ok: true, path, commit: (data as any)?.commit?.sha, data })
}
