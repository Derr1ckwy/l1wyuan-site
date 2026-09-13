'use client'

import { useEffect, useMemo, useState } from 'react'

type MeResponse =
  | { ok: true; login: string }
  | { ok: false; error: string }

type NavCategory = {
  id: string
  title: string
  sections: { id: string; title: string }[]
}

type ImportResponse = {
  ok: boolean
  path?: string
  title?: string
  commit?: string | null
  navCommit?: string | null
  navError?: string | null
  warnings?: string[]
  error?: string
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(path, { cache: 'no-store' })
  return await res.json().catch(() => null)
}

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch('/api/auth/me', { cache: 'no-store' })
  return await res.json()
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(json?.error || `Request failed: ${res.status}`)
  }
  return json
}

export default function Home() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [navJson, setNavJson] = useState('')
  const [mdPath, setMdPath] = useState('search/search-operators')
  const [markdown, setMarkdown] = useState('# New content\n\nWrite here...\n')
  const [status, setStatus] = useState<string>('')

  // Import form state
  const [file, setFile] = useState<File | null>(null)
  const [importTitle, setImportTitle] = useState('')
  const [importPath, setImportPath] = useState('')
  const [categories, setCategories] = useState<NavCategory[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [importResult, setImportResult] = useState<ImportResponse | null>(null)

  useEffect(() => {
    void fetchMe().then(setMe)
  }, [])

  useEffect(() => {
    if (!me || !('ok' in me) || !me.ok) return
    void (async () => {
      const res = (await fetchJson('/api/content/nav')) as
        | { ok: true; navJson: string }
        | { ok: false }
        | null
      if (res && 'ok' in res && res.ok) {
        try {
          const parsed = JSON.parse(res.navJson)
          setCategories(parsed.categories ?? [])
        } catch {
          // ignore malformed nav
        }
      }
    })()
  }, [me])

  const loggedIn = useMemo(() => me && 'ok' in me && me.ok, [me])
  const sections = useMemo(
    () => categories.find((c) => c.id === categoryId)?.sections ?? [],
    [categories, categoryId],
  )

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
      <h1>Admin</h1>
      <p style={{ color: '#666' }}>
        登录后可写回内容仓库：更新 <code>nav.json</code> 和 <code>content/*.md</code>
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        {!loggedIn ? (
          <a
            href="/api/auth/github/start"
            style={{
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            Sign in with GitHub
          </a>
        ) : (
          <>
            <div>Logged in as: {(me as any).login}</div>
            <button
              onClick={async () => {
                await postJson('/api/auth/logout', {})
                setMe({ ok: false, error: 'logged_out' })
              }}
              style={{
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: 10,
                background: 'white',
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>

      <hr style={{ margin: '20px 0' }} />

      <section>
        <h2>Update nav.json</h2>
        <textarea
          value={navJson}
          onChange={(e) => setNavJson(e.target.value)}
          placeholder="Paste full nav.json content here"
          style={{ width: '100%', minHeight: 180, fontFamily: 'monospace' }}
        />
        <div style={{ marginTop: 8 }}>
          <button
            disabled={!loggedIn}
            onClick={async () => {
              setStatus('Saving nav.json...')
              try {
                await postJson('/api/content/upsertNav', { navJson })
                setStatus('nav.json saved')
              } catch (e: any) {
                setStatus(e?.message || 'save failed')
              }
            }}
          >
            Save nav.json
          </button>
        </div>
      </section>

      <hr style={{ margin: '20px 0' }} />

      <section>
        <h2>Update Markdown</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12 }}>
          <label style={{ alignSelf: 'center' }}>mdPath</label>
          <input
            value={mdPath}
            onChange={(e) => setMdPath(e.target.value)}
            placeholder="e.g. search/search-operators"
          />
        </div>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          style={{ width: '100%', minHeight: 220, fontFamily: 'monospace', marginTop: 10 }}
        />
        <div style={{ marginTop: 8 }}>
          <button
            disabled={!loggedIn}
            onClick={async () => {
              setStatus('Saving markdown...')
              try {
                await postJson('/api/content/upsertMarkdown', { mdPath, markdown })
                setStatus('markdown saved')
              } catch (e: any) {
                setStatus(e?.message || 'save failed')
              }
            }}
          >
            Save markdown
          </button>
        </div>
      </section>

      <hr style={{ margin: '20px 0' }} />

      <section>
        <h2>Import Markdown / Word</h2>
        <p style={{ color: '#666', marginTop: 4 }}>
          上传 <code>.md</code> / <code>.txt</code> / <code>.docx</code> 文件，自动写入内容仓库
          （Word 会转换为 Markdown），可选择同时注册到导航。
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <input
            type="file"
            accept=".md,.markdown,.txt,.docx"
            disabled={!loggedIn}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              setImportResult(null)
              if (f) {
                const base = f.name.replace(/\.(md|markdown|txt|docx)$/i, '')
                setImportTitle(base.replace(/[-_]+/g, ' '))
                setImportPath(
                  base
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9一-龥]+/g, '-')
                    .replace(/^-+|-+$/g, ''),
                )
              }
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12 }}>
            <label style={{ alignSelf: 'center' }}>标题</label>
            <input
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
              placeholder="留空则使用文件名"
              disabled={!loggedIn}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12 }}>
            <label style={{ alignSelf: 'center' }}>保存路径 (mdPath)</label>
            <input
              value={importPath}
              onChange={(e) => setImportPath(e.target.value)}
              placeholder="e.g. notes/my-note"
              disabled={!loggedIn}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 12 }}>
            <label style={{ alignSelf: 'center' }}>注册到导航（可选）</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setSectionId('')
              }}
              disabled={!loggedIn}
            >
              <option value="">不注册</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={!loggedIn || !categoryId}
            >
              <option value="">{categoryId ? '选择子栏目' : '—'}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              disabled={!loggedIn || !file}
              onClick={async () => {
                if (!file) return
                setImportStatus('Importing...')
                setImportResult(null)
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  fd.append('title', importTitle)
                  fd.append('mdPath', importPath)
                  if (categoryId && sectionId) {
                    fd.append('categoryId', categoryId)
                    fd.append('sectionId', sectionId)
                  }
                  const res = await fetch('/api/content/import', { method: 'POST', body: fd })
                  const json = (await res.json().catch(() => null)) as ImportResponse | null
                  if (!res.ok || !json?.ok) {
                    throw new Error(json?.error || `Import failed: ${res.status}`)
                  }
                  setImportResult(json)
                  setImportStatus('Import succeeded')
                } catch (e: any) {
                  setImportStatus(e?.message || 'import failed')
                }
              }}
            >
              Import
            </button>
          </div>
        </div>

        {importResult?.ok ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              border: '1px solid #b7e4c7',
              borderRadius: 8,
              background: '#f4fbf6',
              color: '#1b4332',
              fontSize: 13,
              wordBreak: 'break-all',
            }}
          >
            <div>已写入：{importResult.path}</div>
            <div>commit: {importResult.commit}</div>
            {importResult.navCommit ? <div>nav 更新 commit: {importResult.navCommit}</div> : null}
            {importResult.navError ? (
              <div style={{ color: '#9b2226' }}>nav 注册失败：{importResult.navError}</div>
            ) : null}
            {(importResult.warnings ?? []).map((w, i) => (
              <div key={i} style={{ color: '#8a6d00' }}>
                警告：{w}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div style={{ marginTop: 14, color: '#444' }}>Status: {status || importStatus}</div>
    </div>
  )
}
