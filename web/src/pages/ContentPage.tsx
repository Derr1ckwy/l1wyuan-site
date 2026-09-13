import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { findMdItemByPath } from '../data/nav'
import { loadMarkdown } from '../lib/markdown'

export function ContentPage() {
  const params = useParams()
  const mdPath = params['*'] || ''

  const navItem = useMemo(() => findMdItemByPath(mdPath), [mdPath])

  const [text, setText] = useState<string>('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setStatus('loading')
      try {
        const t = await loadMarkdown(mdPath)
        if (cancelled) return
        setText(t)
        setStatus('ready')
      } catch {
        if (cancelled) return
        setStatus('error')
      }
    }

    if (!mdPath) {
      setStatus('error')
      return
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [mdPath])

  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{navItem?.title ?? mdPath}</h1>
        <div className="pageActions">
          <Link to="/" className="pill">
            首页
          </Link>
        </div>
      </div>

      {status === 'loading' ? <div className="muted">加载中...</div> : null}
      {status === 'error' ? <div className="muted">内容不存在或加载失败。</div> : null}

      {status === 'ready' ? (
        <article className="md">
          <ReactMarkdown>{text}</ReactMarkdown>
        </article>
      ) : null}
    </div>
  )
}
