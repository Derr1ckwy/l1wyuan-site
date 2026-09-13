import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { UpsertNavSchema } from '@/lib/schemas'
import { upsertTextFile } from '@/lib/github'
import { NAV_JSON_PATH } from '@/lib/config'

export async function POST(req: Request) {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await req.json().catch(() => null)
  const parsed = UpsertNavSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const message = parsed.data.message ?? `Update nav.json (${new Date().toISOString()})`

  const data = await upsertTextFile({
    path: NAV_JSON_PATH,
    contentText: parsed.data.navJson,
    message,
  })

  console.log('[upsertNav]', {
    path: NAV_JSON_PATH,
    commit: (data as any)?.commit?.sha,
  })

  return NextResponse.json({ ok: true, path: NAV_JSON_PATH, commit: (data as any)?.commit?.sha, data })
}
