import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  const { searchParams } = request.nextUrl
  const funnelId = searchParams.get('funnelId') || null
  const days = parseInt(searchParams.get('days') || '30', 10)

  const { data, error } = await supabase.rpc('get_leads_timeline', {
    p_funnel_id: funnelId,
    p_days: days,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r: any) => ({
    day: r.day,
    newLeads: r.new_leads,
    wonDeals: r.won_deals,
    lostDeals: r.lost_deals,
  }))

  return NextResponse.json(rows)
}
