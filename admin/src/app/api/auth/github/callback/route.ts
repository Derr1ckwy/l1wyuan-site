import { NextResponse } from 'next/server'
import { setAdminSession } from '@/lib/session'
import { ALLOWED_GITHUB_LOGIN } from '@/lib/config'

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: mustEnv('GITHUB_CLIENT_ID'),
      client_secret: mustEnv('GITHUB_CLIENT_SECRET'),
      code,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 })
  }

  const tokenJson: { access_token?: string } = await tokenRes.json()
  const accessToken = tokenJson.access_token
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access token' }, { status: 502 })
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 502 })
  }

  const userJson: { login?: string } = await userRes.json()
  const login = userJson.login
  if (!login) {
    return NextResponse.json({ error: 'Missing login' }, { status: 502 })
  }

  if (login !== ALLOWED_GITHUB_LOGIN) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  await setAdminSession(login)

  return NextResponse.redirect(new URL('/', req.url))
}
