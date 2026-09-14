import { useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
import { useNewNote } from './new-note-context'

// 右下角常驻登录入口：访客显示「登录」，管理员显示身份与退出
// 未登录访客看到的网站与纯展示版完全一致，只是多一个登录入口
export function AuthBar() {
  const { auth, logoutAndRefresh } = useAuth()
  const location = useLocation()
  const openNewNote = useNewNote()

  if (auth.status === 'unknown') return null

  if (auth.status === 'guest') {
    const next = `${location.pathname}${location.search}`
    return (
      <a
        className="authBar pill"
        href={`/api/auth/github/start?next=${encodeURIComponent(next)}`}
      >
        登录
      </a>
    )
  }

  return (
    <div className="authBar authBarAdmin">
      <span className="authBarBadge">✦ {auth.login}</span>
      <button className="authBarBtn" onClick={() => openNewNote()}>
        ＋ 新建
      </button>
      <button
        className="authBarBtn"
        onClick={() => {
          void logoutAndRefresh()
        }}
      >
        退出
      </button>
    </div>
  )
}
