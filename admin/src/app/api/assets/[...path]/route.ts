import { NextResponse } from 'next/server'
import { cached } from '@/lib/cache'
import { getBlobBytes, listRepoFiles } from '@/lib/github'

export const runtime = 'nodejs'

const TREE_TTL_MS = 5 * 60 * 1000

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
}

function extOf(p: string) {
  const i = p.lastIndexOf('.')
  return i >= 0 ? p.slice(i).toLowerCase() : ''
}

// GET /api/assets/[...path] — 图片/静态资源代理
// 浏览器不直接接触被墙的 raw.githubusercontent.com，由服务端经 GitHub API 转发
// 公开只读：只能取到内容仓库 assets/ 里真实存在的文件（path 来自仓库 tree，天然防穿越）
export async function GET(_req: Request, ctx: RouteContext<'/api/assets/[...path]'>) {
  const { path: segments } = await ctx.params
  // URL 路径相对 assets/ 目录：/api/assets/202609/x.png -> assets/202609/x.png
  const repoPath = `assets/${segments.join('/')}`

  if (!repoPath || repoPath.includes('..')) {
    return NextResponse.json({ ok: false, error: 'invalid path' }, { status: 400 })
  }

  // 5 分钟缓存仓库 tree（path -> sha），再按 sha 取 blob
  const tree = await cached('assets:tree', TREE_TTL_MS, () =>
    listRepoFiles('assets').catch(() => [] as { path: string; size: number; sha: string }[]),
  )
  const entry = tree.find((t) => t.path === repoPath)
  if (!entry) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  }

  const buf = await getBlobBytes(entry.sha)

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': MIME[extOf(repoPath)] ?? 'application/octet-stream',
      'Content-Length': String(buf.length),
      // 上传文件名带随机前缀，内容不可变，可以长缓存
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
