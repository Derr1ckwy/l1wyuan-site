import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { RenameMarkdownSchema } from '@/lib/schemas'
import { deleteFile, readTextFile, upsertTextFile } from '@/lib/github'
import { invalidate } from '@/lib/cache'
import {
  CONTENT_DIR,
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
  NAV_JSON_PATH,
} from '@/lib/config'

export const runtime = 'nodejs'

// POST /api/content/rename — 移动/重命名一篇 markdown（新位置写入 + 旧位置删除）
// 注意：会产生两个 commit；nav.json 中的引用不会被自动改写，请用 upsertNav 同步
export async function POST(req: Request) {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await req.json().catch(() => null)
  const parsed = RenameMarkdownSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { oldPath, newPath } = parsed.data
  if (oldPath === newPath) {
    return NextResponse.json({ ok: false, error: 'oldPath and newPath are the same' }, { status: 400 })
  }

  const oldRepoPath = `${CONTENT_DIR}/${oldPath}.md`
  const newRepoPath = `${CONTENT_DIR}/${newPath}.md`
  const baseMessage = parsed.data.message ?? `Rename ${oldPath} -> ${newPath}`

  const oldFile = await readTextFile({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: oldRepoPath,
    branch: CONTENT_REPO_BRANCH,
  })
  if (!oldFile) {
    return NextResponse.json({ ok: false, error: 'source not found' }, { status: 404 })
  }

  const newFile = await readTextFile({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: newRepoPath,
    branch: CONTENT_REPO_BRANCH,
  })
  if (newFile) {
    return NextResponse.json({ ok: false, error: 'target path already exists' }, { status: 409 })
  }

  const created = await upsertTextFile({
    path: newRepoPath,
    contentText: oldFile.text,
    message: `${baseMessage} (create)`,
  })

  let deleteCommit: string | null = null
  let deleteError: string | null = null
  try {
    const deleted = await deleteFile({ path: oldRepoPath, message: `${baseMessage} (delete)` })
    deleteCommit = (deleted as any)?.commit?.sha ?? null
  } catch (e: any) {
    // 新文件已写入但旧文件删除失败：留待人工处理，前端需明确提示
    deleteError = String(e?.message || e)
  }

  // 检查 nav.json 是否引用了旧路径（只提示）
  let referencedInNav = false
  const nav = await readTextFile({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: NAV_JSON_PATH,
    branch: CONTENT_REPO_BRANCH,
  })
  if (nav) referencedInNav = nav.text.includes(`"${oldPath}"`)

  invalidate(`public:md:${oldRepoPath}`)
  invalidate(`public:md:${newRepoPath}`)

  return NextResponse.json({
    ok: !deleteError,
    oldPath,
    newPath,
    referencedInNav,
    createCommit: (created as any)?.commit?.sha,
    deleteCommit,
    ...(deleteError ? { error: `created but delete failed: ${deleteError}` } : {}),
  })
}
