import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useNav } from './nav-context'
import { NewNoteContext } from './new-note-context'
import type { NewNotePreset } from './new-note-context'

type Source = 'blank' | 'paste' | 'file'

function slugifyTitle(t: string) {
  return (
    t
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `note-${Date.now().toString(36)}`
  )
}

// 新建笔记对话框：全局单例，通过 useNewNote() 唤起，可预选分类/栏目
export function NewNoteProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { nav, refreshNav } = useNav()

  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<NewNotePreset>({})
  const [title, setTitle] = useState('')
  const [mdPath, setMdPath] = useState('')
  const [pathTouched, setPathTouched] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [source, setSource] = useState<Source>('blank')
  const [pasted, setPasted] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const sections = useMemo(
    () => nav.categories.find((c) => c.id === categoryId)?.sections ?? [],
    [nav, categoryId],
  )

  function openDialog(p?: NewNotePreset) {
    setPreset(p ?? {})
    setTitle('')
    setMdPath('')
    setPathTouched(false)
    setCategoryId(p?.categoryId ?? '')
    setSectionId(p?.sectionId ?? '')
    setSource('blank')
    setPasted('')
    setFile(null)
    setErr('')
    setOpen(true)
  }

  async function create() {
    if (!title.trim()) {
      setErr('请填写标题')
      return
    }
    const path = mdPath.trim()
    if (!/^[a-z0-9\-/]+$/i.test(path) || path.includes('..')) {
      setErr('保存路径只能是字母/数字/连字符/斜杠，如 notes/my-note')
      return
    }
    setBusy(true)
    setErr('')
    try {
      if (source === 'file') {
        if (!file) {
          setErr('请选择文件')
          return
        }
        const fd = new FormData()
        fd.append('file', file)
        fd.append('title', title.trim())
        fd.append('mdPath', path)
        if (categoryId && sectionId) {
          fd.append('categoryId', categoryId)
          fd.append('sectionId', sectionId)
        }
        const res = await fetch('/api/content/import', { method: 'POST', body: fd })
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; navError?: string }
          | null
        if (!res.ok || !json?.ok) throw new Error(json?.error || `创建失败 (${res.status})`)
        if (json.navError) throw new Error(`笔记已创建，但导航注册失败：${json.navError}`)
      } else {
        const markdown = source === 'paste' ? pasted : `# ${title.trim()}\n`
        const wres = await fetch('/api/content/upsertMarkdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mdPath: path, markdown }),
        })
        const wjson = (await wres.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null
        if (!wres.ok || !wjson?.ok) {
          throw new Error(wjson?.error || `写入失败 (${wres.status})`)
        }
        if (categoryId && sectionId) {
          const rres = await fetch('/api/nav/registerItem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryId,
              sectionId,
              item: { id: path.split('/').pop() ?? path, title: title.trim(), type: 'md', path },
            }),
          })
          const rjson = (await rres.json().catch(() => null)) as
            | { ok?: boolean; error?: string }
            | null
          if (!rres.ok || !rjson?.ok) {
            throw new Error(
              `笔记已创建，但导航注册失败：${rjson?.error ?? rres.status}（可直接访问 /p/${path}）`,
            )
          }
        }
      }
      setOpen(false)
      refreshNav()
      navigate(`/p/${path}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <NewNoteContext.Provider value={openDialog}>
      {children}
      {open
        ? createPortal(
            <div
              className="modalOverlay"
              onClick={(e) => {
                if (e.target === e.currentTarget && !busy) setOpen(false)
              }}
            >
              <div className="modal">
                <div className="modalTitle">新建笔记</div>

                <label className="modalLabel">标题</label>
                <input
                  className="modalInput"
                  value={title}
                  autoFocus
                  placeholder="例如：FastAPI 入门笔记"
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (!pathTouched) {
                      const firstCat = preset.categoryId ?? nav.categories[0]?.id ?? 'notes'
                      setMdPath(`${firstCat}/${slugifyTitle(e.target.value)}`)
                    }
                  }}
                />

                <label className="modalLabel">保存路径</label>
                <input
                  className="modalInput"
                  value={mdPath}
                  placeholder="如 notes/my-note"
                  onChange={(e) => {
                    setMdPath(e.target.value)
                    setPathTouched(true)
                  }}
                />

                <label className="modalLabel">归入导航（可选）</label>
                <div className="modalRow">
                  <select
                    className="modalInput"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value)
                      setSectionId('')
                    }}
                  >
                    <option value="">不注册</option>
                    {nav.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className="modalInput"
                    value={sectionId}
                    disabled={!categoryId}
                    onChange={(e) => setSectionId(e.target.value)}
                  >
                    <option value="">{categoryId ? '选择栏目' : '—'}</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="modalLabel">内容来源</label>
                <div className="modalRow">
                  {(
                    [
                      ['blank', '空白开始'],
                      ['paste', '粘贴文本'],
                      ['file', '上传文件'],
                    ] as [Source, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={`pill modalSrc ${source === value ? 'modalSrcOn' : ''}`}
                      onClick={() => setSource(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {source === 'paste' ? (
                  <textarea
                    className="modalTextarea"
                    value={pasted}
                    placeholder="把 markdown 或纯文本粘贴到这里"
                    onChange={(e) => setPasted(e.target.value)}
                  />
                ) : null}

                {source === 'file' ? (
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                ) : null}

                {err ? <div className="modalErr">{err}</div> : null}

                <div className="modalActions">
                  <button className="pill" disabled={busy} onClick={() => !busy && setOpen(false)}>
                    取消
                  </button>
                  <button className="pill modalPrimary" disabled={busy} onClick={() => void create()}>
                    {busy ? '创建中...' : '创建'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </NewNoteContext.Provider>
  )
}
