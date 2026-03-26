import { NextRequest, NextResponse } from 'next/server'
import { reconcilePendingStatusEvents } from '@/lib/whatsapp-status-events'

export const dynamic = 'force-dynamic'

function getBearerToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}

function isAuthorized(req: NextRequest): boolean {
  const secret = (process.env.SMARTZAP_ADMIN_KEY || process.env.SMARTZAP_API_KEY || '').trim()
  if (!secret) return false

  // Aceita apenas Authorization: Bearer header.
  // Query params são proibidos pois ficam expostos em logs de proxy/servidor.
  const token = getBearerToken(req)
  if (!token) return false

  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false

  const { timingSafeEqual } = require('node:crypto')
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const limit = typeof body?.limit === 'number' ? body.limit : undefined

  try {
    const result = await reconcilePendingStatusEvents({ limit })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const code = String((e as any)?.code || '')
    const msg = String((e as any)?.message || (e instanceof Error ? e.message : e || ''))
    const m = msg.toLowerCase()
    if (code === '42P01' || (m.includes('whatsapp_status_events') && m.includes('does not exist'))) {
      return NextResponse.json(
        { ok: false, error: 'missing_table_whatsapp_status_events', hint: 'Aplique a migration 0018 antes de usar a reconciliação.' },
        { status: 501 }
      )
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  // Allow GET for manual debugging / Vercel cron.
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const limitRaw = req.nextUrl.searchParams.get('limit')
  const limit = limitRaw ? Number(limitRaw) : undefined

  try {
    const result = await reconcilePendingStatusEvents({ limit })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const code = String((e as any)?.code || '')
    const msg = String((e as any)?.message || (e instanceof Error ? e.message : e || ''))
    const m = msg.toLowerCase()
    if (code === '42P01' || (m.includes('whatsapp_status_events') && m.includes('does not exist'))) {
      return NextResponse.json(
        { ok: false, error: 'missing_table_whatsapp_status_events', hint: 'Aplique a migration 0018 antes de usar a reconciliação.' },
        { status: 501 }
      )
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
