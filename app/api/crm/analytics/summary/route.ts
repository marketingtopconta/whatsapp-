import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  const { searchParams } = request.nextUrl
  const funnelId = searchParams.get('funnelId') || null
  const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = searchParams.get('endDate') || new Date().toISOString()

  const { data, error } = await supabase.rpc('get_crm_summary', {
    p_funnel_id: funnelId,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    totalDeals: data?.total_deals ?? 0,
    openDeals: data?.open_deals ?? 0,
    wonDeals: data?.won_deals ?? 0,
    lostDeals: data?.lost_deals ?? 0,
    totalValueOpen: data?.total_value_open ?? 0,
    totalValueWon: data?.total_value_won ?? 0,
    avgDealValue: data?.avg_deal_value ?? 0,
    conversionRate: data?.conversion_rate ?? 0,
    newLeadsPeriod: data?.new_leads_period ?? 0,
  })
}
