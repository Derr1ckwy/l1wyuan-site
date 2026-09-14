import { NextResponse } from 'next/server'
import mammoth from 'mammoth'

import { requireAdminLogin } from '@/lib/authz'
import { MdPathSchema } from '@/lib/schemas'
import { readTextFile, upsertTextFile } from '@/lib/github'
import {
  CONTENT_DIR,
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
  NAV_JSON_PATH,
} from '@/lib/config'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 20 * 1024 * 1024

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status })
}

// mammoth 1.12.3 的类型声明缺少 convertToMarkdown（运行时已存在），这里补齐签名
const convertToMarkdown = (
  mammoth as unknown as {
    convertToMarkdown: (input: {
      buffer: Buffer
    }) => Promise<{ value: string; messages: { type: string; message: string }[] }>
  }
).convertToMarkdown

async function fileToMarkdown(file: File): Promise<{ markdown: string; warnings: string[] }> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.docx')) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await convertToMarkdown({ buffer })
    return {
      markdown: result.value,
      warnings: result.messages.map((m) => `${m.type}: ${m.message}`).slice(0, 5),
    }
  }

  if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')) {
    return { markdown: await file.text(), warnings: [] }
  }

  throw new Error(`Unsupported file type: ${file.name} (only .md / .txt / .docx)`)
}

function defaultTitle(fileName: string): string {
  const base = fileName.replace(/\.(md|markdown|txt|docx)$/i, '')
  return base.replace(/[-_]+/g, ' ').trim() || base
}

function slugify(fileName: string): string {
  return fileName
    .replace(/\.(md|markdown|txt|docx)$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
  if (file.size > MAX_FILE_BYTES) return jsonError('file too large (max 20MB)', 400)

  const titleRaw = String(form.get('title') || '').trim()
  const mdPathRaw = String(form.get('mdPath') || '').trim()
  const categoryId = String(form.get('categoryId') || '').trim()
  const sectionId = String(form.get('sectionId') || '').trim()

  const mdPath = mdPathRaw || slugify(file.name)
  const parsedPath = MdPathSchema.safeParse(mdPath)
  if (!parsedPath.success) {
    return jsonError('invalid mdPath', 400, { issues: parsedPath.error.issues })
  }

  let markdown: string
  let warnings: string[]
  try {
    ;({ markdown, warnings } = await fileToMarkdown(file))
  } catch (e: any) {
    return jsonError(e?.message || 'failed to convert file', 400)
  }

  const title = titleRaw || defaultTitle(file.name)
  const relPath = `${CONTENT_DIR}/${parsedPath.data}.md`

  const fileResult = await upsertTextFile({
    path: relPath,
    contentText: markdown,
    message: `Import ${file.name} -> ${relPath} (via admin)`,
  })

  let navCommit: string | null = null
  let navError: string | null = null

  if (categoryId && sectionId) {
    try {
      const nav = await readTextFile({
        owner: CONTENT_REPO_OWNER,
        repo: CONTENT_REPO_NAME,
        path: NAV_JSON_PATH,
        branch: CONTENT_REPO_BRANCH,
      })
      if (!nav) throw new Error('nav.json not found in content repo')

      const navJson = JSON.parse(nav.text)
      const category = navJson.categories?.find((c: any) => c.id === categoryId)
      const section = category?.sections?.find((s: any) => s.id === sectionId)
      if (!section) throw new Error(`category/section not found: ${categoryId}/${sectionId}`)

      const newItem = {
        id: slugify(file.name) || parsedPath.data.replace(/\//g, '-'),
        title,
        type: 'md',
        path: parsedPath.data,
      }
      const existing = section.items.find((it: any) => it.path === newItem.path)
      if (existing) {
        existing.title = title
      } else {
        section.items.push(newItem)
      }

      const navResult = await upsertTextFile({
        path: NAV_JSON_PATH,
        contentText: JSON.stringify(navJson, null, 2) + '\n',
        message: `Register ${parsedPath.data} in nav (${categoryId}/${sectionId})`,
      })
      navCommit = (navResult as any)?.commit?.sha ?? null
    } catch (e: any) {
      navError = e?.message || 'nav update failed'
    }
  }

  return NextResponse.json({
    ok: true,
    path: relPath,
    title,
    size: file.size,
    commit: (fileResult as any)?.commit?.sha ?? null,
    navCommit,
    navError,
    warnings,
  })
}
