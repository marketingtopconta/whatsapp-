import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  const { searchParams } = request.nextUrl
  const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = searchParams.get('endDate') || new Date().toISOString()
  const campaign = searchParams.get('campaign') || null

  const { data, error } = await supabase.rpc('get_app_link_funnel', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_campaign: campaign,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    sent: data?.sent ?? 0,
    clicked: data?.clicked ?? 0,
    installed: data?.installed ?? 0,
    accountOpened: data?.account_opened ?? 0,
    firstPurchase: data?.first_purchase ?? 0,
    clickRate: data?.click_rate ?? 0,
    installRate: data?.install_rate ?? 0,
    conversionRate: data?.conversion_rate ?? 0,
  })
}
