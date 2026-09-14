import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { useNav } from '../components/nav-context'
import { useAuth } from '../components/auth-context'
import { useNewNote } from '../components/new-note-context'

function slugifySectionId(t: string) {
  return (
    t
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `section-${Date.now().toString(36)}`
  )
}

export function CategoryPage() {
  const params = useParams()
  const categoryId = params.categoryId || ''
  const { auth } = useAuth()
  const { nav, refreshNav } = useNav()
  const openNewNote = useNewNote()
  const isAdmin = auth.status === 'admin'

  const category = nav.categories.find((c) => c.id === categoryId)

  // 添加栏目对话框
  const [adding, setAdding] = useState(false)
  const [secTitle, setSecTitle] = useState('')
  const [secId, setSecId] = useState('')
  const [secIdTouched, setSecIdTouched] = useState(false)
  const [secBusy, setSecBusy] = useState(false)
  const [secErr, setSecErr] = useState('')

  if (!category) {
    return (
      <div className="page">
        <h1>未找到栏目</h1>
        <Link to="/" className="pill">
          返回首页
        </Link>
      </div>
    )
  }

  async function addSection() {
    const title = secTitle.trim()
    const id = secId.trim()
    if (!title) {
      setSecErr('请填写栏目名称')
      return
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      setSecErr('栏目 ID 只能是小写字母/数字/连字符')
      return
    }
    setSecBusy(true)
    setSecErr('')
    try {
      const res = await fetch('/api/nav/registerSection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, section: { id, title } }),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `创建失败 (${res.status})`)
      }
      setAdding(false)
      refreshNav()
    } catch (e) {
      setSecErr(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSecBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{category.title}</h1>
        <div className="muted">{category.description}</div>
        {isAdmin ? (
          <div className="pageActions">
            <button
              className="pill editToggle"
              onClick={() => {
                setSecTitle('')
                setSecId('')
                setSecIdTouched(false)
                setSecErr('')
                setAdding(true)
              }}
            >
              ＋ 添加栏目
            </button>
          </div>
        ) : null}
      </div>

      <div className="sections">
        {category.sections.map((section) => (
          <div key={section.id} className="section">
            <h2 className="sectionHead">
              <span>{section.title}</span>
              {isAdmin ? (
                <button
                  className="pill sectionAddBtn"
                  onClick={() => openNewNote({ categoryId, sectionId: section.id })}
                >
                  ＋ 添加文档
                </button>
              ) : null}
            </h2>
            <div className="items">
              {section.items.filter((it) => it.type === 'md').length > 0 ? (
                section.items
                  .filter((it) => it.type === 'md')
                  .map((item) => (
                    <Link key={item.id} className="item" to={`/p/${item.path}`}>
                      {item.title}
                    </Link>
                  ))
              ) : (
                <div className="muted">这个栏目下还没有内容。</div>
              )}
            </div>
          </div>
        ))}
        {category.sections.length === 0 ? (
          <div className="muted">这个分类下还没有栏目{isAdmin ? '，点击上方「＋ 添加栏目」创建。' : '。'}</div>
        ) : null}
      </div>

      {adding
        ? createPortal(
            <div
              className="modalOverlay"
              onClick={(e) => {
                if (e.target === e.currentTarget && !secBusy) setAdding(false)
              }}
            >
              <div className="modal">
                <div className="modalTitle">在「{category.title}」下添加栏目</div>

                <label className="modalLabel">栏目名称</label>
                <input
                  className="modalInput"
                  value={secTitle}
                  autoFocus
                  placeholder="例如：读书笔记"
                  onChange={(e) => {
                    setSecTitle(e.target.value)
                    if (!secIdTouched) setSecId(slugifySectionId(e.target.value))
                  }}
                />

                <label className="modalLabel">栏目 ID</label>
                <input
                  className="modalInput"
                  value={secId}
                  placeholder="如 reading-notes"
                  onChange={(e) => {
                    setSecId(e.target.value)
                    setSecIdTouched(true)
                  }}
                />

                {secErr ? <div className="modalErr">{secErr}</div> : null}

                <div className="modalActions">
                  <button
                    className="pill"
                    disabled={secBusy}
                    onClick={() => !secBusy && setAdding(false)}
                  >
                    取消
                  </button>
                  <button className="pill modalPrimary" disabled={secBusy} onClick={() => void addSection()}>
                    {secBusy ? '创建中...' : '创建'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
