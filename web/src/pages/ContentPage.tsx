import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useNav } from '../components/nav-context'
import { findMdItemByPath } from '../lib/nav-helpers'
import { loadMarkdown } from '../lib/markdown'
import { useAuth } from '../components/auth-context'

export function ContentPage() {
  const params = useParams()
  const mdPath = params['*'] || ''
  const { auth } = useAuth()
  const { nav } = useNav()
  const isAdmin = auth.status === 'admin'

  const navItem = useMemo(() => findMdItemByPath(nav, mdPath), [nav, mdPath])

  const [text, setText] = useState<string>('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  // 编辑形态
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editorMsg, setEditorMsg] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    if (!mdPath) {
      queueMicrotask(() => {
        if (!cancelled) setStatus('error')
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (!cancelled) setStatus('loading')
    })
    loadMarkdown(mdPath)
      .then((t) => {
        if (cancelled) return
        setText(t)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [mdPath])

  // 切换文章时退出编辑态
  useEffect(() => {
    queueMicrotask(() => {
      setEditing(false)
      setEditorMsg('')
    })
  }, [mdPath])

  async function saveDraft() {
    setSaving(true)
    setEditorMsg('保存中...')
    try {
      const res = await fetch('/api/content/upsertMarkdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mdPath, markdown: draft }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `保存失败 (${res.status})`)
      }
      // 保存成功后从 API 重读最新内容，立即生效
      const t = await loadMarkdown(mdPath)
      setText(t)
      setEditing(false)
      setEditorMsg('')
    } catch (e) {
      setEditorMsg(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(file: File) {
    setEditorMsg('图片上传中...')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/content/uploadImage', { method: 'POST', body: fd })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; url?: string; error?: string }
        | null
      if (!res.ok || !json?.ok || !json.url) {
        throw new Error(json?.error || `上传失败 (${res.status})`)
      }
      // 在光标处插入 ![](url)
      const ta = textareaRef.current
      const snippet = `![](${json.url})`
      if (ta) {
        const start = ta.selectionStart ?? draft.length
        const end = ta.selectionEnd ?? draft.length
        const next = draft.slice(0, start) + snippet + draft.slice(end)
        setDraft(next)
        requestAnimationFrame(() => {
          ta.focus()
          const pos = start + snippet.length
          ta.setSelectionRange(pos, pos)
        })
      } else {
        setDraft((d) => d + '\n\n' + snippet)
      }
      setEditorMsg('')
    } catch (e) {
      setEditorMsg(e instanceof Error ? e.message : '上传失败')
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{navItem?.title ?? mdPath}</h1>
        <div className="pageActions">
          <Link to="/" className="pill">
            首页
          </Link>
          {isAdmin && !editing && status === 'ready' ? (
            <button
              className="pill editToggle"
              onClick={() => {
                setDraft(text)
                setEditorMsg('')
                setEditing(true)
              }}
            >
              编辑此页
            </button>
          ) : null}
        </div>
      </div>

      {status === 'loading' ? <div className="muted">加载中...</div> : null}
      {status === 'error' ? <div className="muted">内容不存在或加载失败。</div> : null}

      {editing ? (
        <section className="editor">
          <div className="editorToolbar">
            <button className="pill" disabled={saving} onClick={() => void saveDraft()}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              className="pill"
              disabled={saving}
              onClick={() => {
                setEditing(false)
                setEditorMsg('')
              }}
            >
              取消
            </button>
            <button className="pill" disabled={saving} onClick={() => imgInputRef.current?.click()}>
              插入图片
            </button>
            <span className="muted editorPath">{mdPath}.md</span>
            {editorMsg ? <span className="editorMsg">{editorMsg}</span> : null}
            <input
              ref={imgInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp,.avif"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadImage(f)
                e.target.value = ''
              }}
            />
          </div>
          <div className="editorGrid">
            <textarea
              ref={textareaRef}
              className="editorTextarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
            />
            <article className="md editorPreview">
              <ReactMarkdown>{draft}</ReactMarkdown>
            </article>
          </div>
        </section>
      ) : null}

      {!editing && status === 'ready' ? (
        <article className="md">
          <ReactMarkdown>{text}</ReactMarkdown>
        </article>
      ) : null}
    </div>
  )
}
