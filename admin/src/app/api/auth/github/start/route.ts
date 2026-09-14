import { NextResponse } from 'next/server'

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const redirectUri = new URL('/api/auth/github/callback', url.origin).toString()

  const params = new URLSearchParams({
    client_id: mustEnv('GITHUB_CLIENT_ID'),
    redirect_uri: redirectUri,
    scope: 'read:user',
  })

  // 登录成功后想回到的页面（由前端传入完整 URL），放进 OAuth state 带回
  const next = url.searchParams.get('next')
  if (next) params.set('state', next)

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`)
}
