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

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`)
}
