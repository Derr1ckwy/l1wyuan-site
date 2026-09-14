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

type MdFile = { mdPath: string; size: number; sha: string }

type ListResponse = { ok: true; files: MdFile[]; total: number } | { ok: false; error: string }

type GetContentResponse =
  | { ok: true; mdPath: string; markdown: string; sha: string }
  | { ok: false; error: string }

type DeleteResponse =
  | { ok: true; mdPath: string; referencedInNav: boolean; commit?: string }
  | { ok: false; error: string }

type RenameResponse = {
  ok: boolean
  oldPath?: string
  newPath?: string
  referencedInNav?: boolean
  createCommit?: string | null
  deleteCommit?: string | null
  error?: string
}

type UploadImageResponse =
  | { ok: true; path: string; url: string; size: number; commit?: string }
  | { ok: false; error: string }

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

  // Content file list / edit state
  const [files, setFiles] = useState<MdFile[]>([])
  const [filesStatus, setFilesStatus] = useState('')
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState('')

  // Image upload state
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPrefix, setImgPrefix] = useState('')
  const [imgStatus, setImgStatus] = useState('')
  const [imgResult, setImgResult] = useState<UploadImageResponse | null>(null)

  const loggedIn = useMemo(() => me && 'ok' in me && me.ok, [me])
  const sections = useMemo(
    () => categories.find((c) => c.id === categoryId)?.sections ?? [],
    [categories, categoryId],
  )

  const fetchFileList = async (): Promise<MdFile[]> => {
    const res = await fetchJson('/api/content/list')
    if (res && typeof res === 'object' && 'ok' in res && (res as ListResponse).ok) {
      return (res as unknown as { files: MdFile[] }).files
    }
    throw new Error('加载失败：' + ((res as { error?: string })?.error ?? 'unknown'))
  }

  const loadFiles = async () => {
    try {
      const list = await fetchFileList()
      setFiles(list)
      setFilesStatus('')
    } catch (e: any) {
      setFilesStatus(e?.message || '加载失败')
    }
  }

  useEffect(() => {
    void fetchMe().then(setMe)
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    let alive = true
    fetchFileList()
      .then((list) => {
        if (!alive) return
        setFiles(list)
        setFilesStatus('')
      })
      .catch((e: any) => {
        if (alive) setFilesStatus(e?.message || '加载失败')
      })
    return () => {
      alive = false
    }
  }, [loggedIn])

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
          <button
            disabled={!loggedIn}
            onClick={() => void loadFiles()}
            style={{ marginLeft: 8 }}
          >
            刷新列表
          </button>
        </div>
      </section>

      <hr style={{ margin: '20px 0' }} />

      <section>
        <h2>内容文件（{files.length}）</h2>
        <p style={{ color: '#666', marginTop: 4 }}>
          点击「载入」把文件内容加载到上方编辑器；改名/删除不会自动改写 nav.json，操作后请注意导航引用。
        </p>
        {filesStatus ? <div style={{ color: '#8a6d00' }}>{filesStatus}</div> : null}
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
          {files.map((f) => (
            <li
              key={f.mdPath}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid #eee',
                fontSize: 14,
              }}
            >
              {renamingPath === f.mdPath ? (
                <>
                  <input
                    value={renameTarget}
                    onChange={(e) => setRenameTarget(e.target.value)}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                    autoFocus
                  />
                  <button
                    disabled={!loggedIn || !renameTarget.trim()}
                    onClick={async () => {
                      try {
                        const json = (await postJson('/api/content/rename', {
                          oldPath: f.mdPath,
                          newPath: renameTarget.trim(),
                        })) as RenameResponse
                        setStatus(
                          `已改名：${json.oldPath} -> ${json.newPath}` +
                            (json.referencedInNav ? '（nav.json 仍引用旧路径，请手动更新！）' : ''),
                        )
                        setRenamingPath(null)
                        if (mdPath === f.mdPath) setMdPath(json.newPath ?? mdPath)
                        void loadFiles()
                      } catch (e: any) {
                        setStatus(e?.message || 'rename failed')
                      }
                    }}
                  >
                    确认
                  </button>
                  <button onClick={() => setRenamingPath(null)}>取消</button>
                </>
              ) : (
                <>
                  <code style={{ flex: 1 }}>{f.mdPath}</code>
                  <span style={{ color: '#999' }}>{f.size}B</span>
                  <button
                    disabled={!loggedIn}
                    onClick={async () => {
                      setStatus(`载入 ${f.mdPath} ...`)
                      try {
                        const res = (await fetchJson(
                          `/api/content/get?path=${encodeURIComponent(f.mdPath)}`,
                        )) as GetContentResponse | null
                        if (res && res.ok) {
                          setMdPath(res.mdPath)
                          setMarkdown(res.markdown)
                          setStatus(`已载入 ${res.mdPath}`)
                        } else {
                          setStatus('载入失败：' + ((res as { error?: string })?.error ?? 'unknown'))
                        }
                      } catch (e: any) {
                        setStatus(e?.message || 'load failed')
                      }
                    }}
                  >
                    载入
                  </button>
                  <button
                    disabled={!loggedIn}
                    onClick={() => {
                      setRenamingPath(f.mdPath)
                      setRenameTarget(f.mdPath)
                    }}
                  >
                    改名
                  </button>
                  <button
                    disabled={!loggedIn}
                    onClick={async () => {
                      if (!window.confirm(`确认删除 ${f.mdPath}.md？此操作会写入一次 git commit。`)) return
                      try {
                        const json = (await postJson('/api/content/delete', {
                          mdPath: f.mdPath,
                        })) as DeleteResponse & { ok: true }
                        setStatus(
                          `已删除：${json.mdPath}` +
                            (json.referencedInNav ? '（nav.json 仍引用该路径，请手动移除！）' : ''),
                        )
                        if (mdPath === f.mdPath) setMarkdown('')
                        void loadFiles()
                      } catch (e: any) {
                        setStatus(e?.message || 'delete failed')
                      }
                    }}
                  >
                    删除
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <hr style={{ margin: '20px 0' }} />

      <section>
        <h2>上传图片</h2>
        <p style={{ color: '#666', marginTop: 4 }}>
          图片写入内容仓库 <code>assets/</code> 目录，返回的 URL 可直接粘贴进 markdown。支持
          png / jpg / gif / webp / avif，最大 5MB。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, marginTop: 10 }}>
          <label style={{ alignSelf: 'center' }}>图片文件</label>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,.avif"
            disabled={!loggedIn}
            onChange={(e) => {
              setImgFile(e.target.files?.[0] ?? null)
              setImgResult(null)
              setImgStatus('')
            }}
          />
          <label style={{ alignSelf: 'center' }}>文件名前缀（可选）</label>
          <input
            value={imgPrefix}
            onChange={(e) => setImgPrefix(e.target.value)}
            placeholder="e.g. notes（会成为 assets/年月/notes-xxxx-name.png）"
            disabled={!loggedIn}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <button
            disabled={!loggedIn || !imgFile}
            onClick={async () => {
              if (!imgFile) return
              setImgStatus('上传中...')
              setImgResult(null)
              try {
                const fd = new FormData()
                fd.append('file', imgFile)
                if (imgPrefix.trim()) fd.append('prefix', imgPrefix.trim())
                const res = await fetch('/api/content/uploadImage', { method: 'POST', body: fd })
                const json = (await res.json().catch(() => null)) as UploadImageResponse | null
                if (!res.ok || !json?.ok) {
                  throw new Error((json as { error?: string })?.error || `上传失败: ${res.status}`)
                }
                setImgResult(json)
                setImgStatus('上传成功')
              } catch (e: any) {
                setImgStatus(e?.message || 'upload failed')
              }
            }}
          >
            上传
          </button>
          <span style={{ marginLeft: 10, color: '#444' }}>{imgStatus}</span>
        </div>
        {imgResult?.ok ? (
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
            <div>
              已写入：<code>{imgResult.path}</code>（{imgResult.size}B）
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <code style={{ flex: 1 }}>{imgResult.url}</code>
              <button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`![](${imgResult.url})`)
                    .then(() => setImgStatus('markdown 已复制到剪贴板'))
                    .catch(() => setImgStatus('复制失败，请手动复制'))
                }}
              >
                复制 ![](url)
              </button>
            </div>
            <div style={{ color: '#8a6d00', marginTop: 6 }}>
              注意：raw.githubusercontent.com 在部分网络下无法访问，图片可能裂图。
            </div>
          </div>
        ) : null}
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
                  void loadFiles()
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
