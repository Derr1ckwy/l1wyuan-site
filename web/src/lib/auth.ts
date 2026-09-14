// 登录态：由 /api/auth/me 判定（服务端校验 GitHub 登录名白名单）
export type AuthState =
  | { status: 'unknown' }
  | { status: 'guest' }
  | { status: 'admin'; login: string }

export async function fetchMe(): Promise<AuthState> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    if (!res.ok) return { status: 'guest' }
    const json = (await res.json().catch(() => null)) as { ok?: boolean; login?: string } | null
    if (json?.ok && json.login) return { status: 'admin', login: json.login }
    return { status: 'guest' }
  } catch {
    // API 不可达（如静态部署无后端）：按访客处理，界面不出现编辑入口
    return { status: 'guest' }
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
}
