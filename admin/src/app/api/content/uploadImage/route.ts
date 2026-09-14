import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'
import { upsertBinaryFile, rawFileUrl } from '@/lib/github'
import { invalidate } from '@/lib/cache'

export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\.]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status })
}

// POST /api/content/uploadImage — multipart：file + 可选 prefix
// 图片写入内容仓库 assets/ 目录，返回 raw URL 可直接用于 markdown 的 ![](...)
export async function POST(req: Request) {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return jsonError('unauthorized', auth.status)
  }

  const form = await req.formData().catch(() => null)
  if (!form) return jsonError('expected multipart/form-data', 400)

  const file = form.get('file')
  if (!(file instanceof File)) return jsonError('missing field: file', 400)
  if (file.size === 0) return jsonError('file is empty', 400)
  if (file.size > MAX_IMAGE_BYTES) return jsonError('file too large (max 5MB)', 400)

  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXT[ext]) {
    return jsonError(`unsupported image type: .${ext} (allowed: ${Object.keys(ALLOWED_EXT).join('/')})`, 400)
  }

  // 服务端再校验一次 MIME，防止改后缀上传
  if (file.type && file.type !== ALLOWED_EXT[ext]) {
    return jsonError(`MIME mismatch: file is ${file.type}, expected ${ALLOWED_EXT[ext]}`, 400)
  }

  const prefixRaw = String(form.get('prefix') || '').trim()
  const prefix = prefixRaw ? slugify(prefixRaw).replace(/\./g, '-') : ''

  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6)
  const name = slugify(file.name) || `image.${ext}`
  const repoPath = `assets/${ym}/${prefix ? `${prefix}-` : ''}${rand}-${name}`

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  const data = await upsertBinaryFile({
    path: repoPath,
    base64Content: base64,
    message: `Upload image ${repoPath}`,
  })

  invalidate('assets:tree')

  return NextResponse.json({
    ok: true,
    path: repoPath,
    // 统一走 /api/assets 代理（绕过访客侧 raw.githubusercontent.com 不可达的问题）
    url: `/api/assets/${repoPath.replace(/^assets\//, '')}`,
    rawUrl: rawFileUrl(repoPath),
    size: file.size,
    commit: (data as any)?.commit?.sha,
  })
}
