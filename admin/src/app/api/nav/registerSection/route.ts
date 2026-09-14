import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { RegisterNavSectionSchema } from '@/lib/schemas'
import { readTextFile, upsertTextFile } from '@/lib/github'
import { invalidate } from '@/lib/cache'
import {
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
  NAV_JSON_PATH,
} from '@/lib/config'

export const runtime = 'nodejs'

// POST /api/nav/registerSection — 在某个分类下新建栏目（需登录）
export async function POST(req: Request) {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await req.json().catch(() => null)
  const parsed = RegisterNavSectionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { categoryId, section } = parsed.data

  const nav = await readTextFile({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: NAV_JSON_PATH,
    branch: CONTENT_REPO_BRANCH,
  })
  if (!nav) {
    return NextResponse.json({ ok: false, error: 'nav.json not found' }, { status: 404 })
  }

  let navJson: any
  try {
    navJson = JSON.parse(nav.text)
  } catch {
    return NextResponse.json({ ok: false, error: 'nav.json is not valid JSON' }, { status: 500 })
  }

  const category = navJson.categories?.find((c: any) => c.id === categoryId)
  if (!category) {
    return NextResponse.json(
      { ok: false, error: `category not found: ${categoryId}` },
      { status: 404 },
    )
  }

  if (!Array.isArray(category.sections)) category.sections = []
  if (category.sections.some((s: any) => s.id === section.id)) {
    return NextResponse.json(
      { ok: false, error: `section already exists: ${section.id}` },
      { status: 409 },
    )
  }

  category.sections.push({ id: section.id, title: section.title, items: [] })

  const message =
    parsed.data.message ?? `Add section ${section.id} to ${categoryId}`
  const data = await upsertTextFile({
    path: NAV_JSON_PATH,
    contentText: JSON.stringify(navJson, null, 2) + '\n',
    message,
  })

  invalidate('public:nav')

  return NextResponse.json({
    ok: true,
    categoryId,
    section,
    commit: (data as any)?.commit?.sha ?? null,
  })
}
