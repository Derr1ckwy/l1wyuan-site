import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { readTextFile } from '@/lib/github'
import {
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
  NAV_JSON_PATH,
} from '@/lib/config'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  const nav = await readTextFile({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: NAV_JSON_PATH,
    branch: CONTENT_REPO_BRANCH,
  })

  if (!nav) {
    return NextResponse.json({ ok: false, error: 'nav.json not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, navJson: nav.text })
}
