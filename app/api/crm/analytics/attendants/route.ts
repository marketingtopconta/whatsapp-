import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  const { searchParams } = request.nextUrl
  const funnelId = searchParams.get('funnelId') || null
  const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = searchParams.get('endDate') || new Date().toISOString()

  const { data, error } = await supabase.rpc('get_attendant_performance', {
    p_funnel_id: funnelId,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r: any) => ({
    attendant: r.attendant,
    totalDeals: r.total_deals,
    openDeals: r.open_deals,
    wonDeals: r.won_deals,
    lostDeals: r.lost_deals,
    totalValue: r.total_value,
    wonValue: r.won_value,
    conversionRate: r.conversion_rate,
  }))

  return NextResponse.json(rows)
}
