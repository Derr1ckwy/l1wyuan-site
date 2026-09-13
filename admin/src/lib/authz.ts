import { getAdminLogin } from './session'
import { ALLOWED_GITHUB_LOGIN } from './config'

export async function requireAdminLogin() {
  const login = await getAdminLogin()
  if (!login) {
    return { ok: false as const, status: 401 as const, login: null }
  }
  if (login !== ALLOWED_GITHUB_LOGIN) {
    return { ok: false as const, status: 403 as const, login }
  }
  return { ok: true as const, status: 200 as const, login }
}
