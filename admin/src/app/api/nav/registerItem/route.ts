import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { RegisterNavItemSchema } from '@/lib/schemas'
import { readTextFile, upsertTextFile } from '@/lib/github'
import { invalidate } from '@/lib/cache'
import {
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
  NAV_JSON_PATH,
} from '@/lib/config'

export const runtime = 'nodejs'

// POST /api/nav/registerItem — 向 nav.json 的指定栏目注册条目（需登录）
// 服务端读-改-写：比前端全量 upsertNav 安全，不会覆盖他人并发修改以外的意外内容
export async function POST(req: Request) {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await req.json().catch(() => null)
  const parsed = RegisterNavItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { categoryId, sectionId, item } = parsed.data

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
    return NextResponse.json({ ok: false, error: `category not found: ${categoryId}` }, { status: 404 })
  }
  const section = category.sections?.find((s: any) => s.id === sectionId)
  if (!section) {
    return NextResponse.json(
      { ok: false, error: `section not found: ${categoryId}/${sectionId}` },
      { status: 404 },
    )
  }

  if (item.type === 'md') {
    if (!item.path) {
      return NextResponse.json({ ok: false, error: 'md item requires path' }, { status: 400 })
    }
    const existing = section.items?.find((it: any) => it.path === item.path)
    if (existing) {
      return NextResponse.json(
        { ok: false, error: `path already registered in ${categoryId}/${sectionId}: ${item.path}` },
        { status: 409 },
      )
    }
  }

  if (!Array.isArray(section.items)) section.items = []
  const { type, id, title } = item
  section.items.push({
    id,
    title,
    type,
    ...(type === 'md' ? { path: item.path } : { url: item.url }),
  })

  const message =
    parsed.data.message ?? `Register ${id} in nav (${categoryId}/${sectionId})`
  const data = await upsertTextFile({
    path: NAV_JSON_PATH,
    contentText: JSON.stringify(navJson, null, 2) + '\n',
    message,
  })

  invalidate('public:nav')

  return NextResponse.json({
    ok: true,
    categoryId,
    sectionId,
    item: { id, title, type },
    commit: (data as any)?.commit?.sha ?? null,
  })
}
