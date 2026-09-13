import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'admin_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function sign(data: string): string {
  const secret = mustEnv('SESSION_SECRET')
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

export async function setAdminSession(login: string) {
  const now = Date.now()
  const payload = `${login}:${now}`
  const value = `${payload}:${sign(payload)}`

  const jar = await cookies()
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearAdminSession() {
  const jar = await cookies()
  jar.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function getAdminLogin(): Promise<string | null> {
  const jar = await cookies()
  const v = jar.get(COOKIE_NAME)?.value
  if (!v) return null

  const parts = v.split(':')
  if (parts.length < 3) return null
  const login = parts[0]
  const ts = parts[1]
  const sig = parts.slice(2).join(':')

  const payload = `${login}:${ts}`
  if (sign(payload) !== sig) return null

  return login
}
