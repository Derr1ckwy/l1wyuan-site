import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { listRepoFiles } from '@/lib/github'
import { CONTENT_DIR } from '@/lib/config'

export const runtime = 'nodejs'

// GET /api/content/list — 列出内容仓库里所有 markdown 文件
export async function GET() {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  try {
    const files = await listRepoFiles(CONTENT_DIR)
    const mdFiles = files
      .filter((f) => f.path.endsWith('.md'))
      .map((f) => ({
        mdPath: f.path.slice(CONTENT_DIR.length + 1, -'.md'.length),
        size: f.size,
        sha: f.sha,
      }))
      .sort((a, b) => a.mdPath.localeCompare(b.mdPath))

    return NextResponse.json({ ok: true, files: mdFiles, total: mdFiles.length })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `list failed: ${String(e?.message || e)}` },
      { status: 500 },
    )
  }
}
