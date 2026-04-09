import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  const { searchParams } = request.nextUrl
  const funnelId = searchParams.get('funnelId') || null
  const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = searchParams.get('endDate') || new Date().toISOString()

  const { data, error } = await supabase.rpc('get_funnel_conversion_rates', {
    p_funnel_id: funnelId,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r: any) => ({
    stageId: r.stage_id,
    stageName: r.stage_name,
    stageOrder: r.stage_order,
    stageColor: r.stage_color,
    totalDeals: r.total_deals,
    wonFromStage: r.won_from_stage,
    lostFromStage: r.lost_from_stage,
    conversionRate: r.conversion_rate,
    avgTimeSeconds: r.avg_time_seconds,
  }))

  return NextResponse.json(rows)
}
