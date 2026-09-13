import { NextResponse } from 'next/server'
import { requireAdminLogin } from '@/lib/authz'

export async function GET() {
  const auth = await requireAdminLogin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: auth.status })
  }

  return NextResponse.json({ ok: true, login: auth.login })
}
