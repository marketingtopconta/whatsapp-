import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Allow 60s cache on Vercel Edge - dashboard uses realtime/polling for updates
export const revalidate = 60

// Formato do gráfico de 30 dias consumido pelo dashboard
interface ChartDataPoint {
  name: string
  sent: number
  read: number
  delivered: number
  failed: number
  active: number
}

async function getChartData(): Promise<ChartDataPoint[]> {
  // Agregação diária calculada no Postgres (migration 20260730000000) -
  // evita baixar TODAS as campanhas para agregar no client.
  const { data, error } = await supabase.rpc('get_campaign_daily_stats', { p_days: 30 })

  if (error || !data) {
    // RPC ainda não aplicada (migration pendente) - dashboard funciona sem o gráfico
    console.warn('[dashboard/stats] get_campaign_daily_stats indisponível:', error?.message)
    return []
  }

  return (data as Array<{ day: string; sent: number; delivered: number; read: number; failed: number; active: number }>).map((row) => {
    const [year, month, day] = row.day.split('-')
    return {
      name: `${day}/${month}`,
      sent: row.sent,
      read: row.read,
      delivered: row.delivered,
      failed: row.failed,
      active: row.active,
    }
  })
}

export async function GET() {
  try {
    // Try to use pre-aggregated view first (migration 0033)
    const [{ data: viewData, error: viewError }, chartData] = await Promise.all([
      supabase.from('campaign_stats_summary').select('*').single(),
      getChartData(),
    ])

    // View exists and returned data - use optimized path
    if (!viewError && viewData) {
      const totalSent = viewData.total_sent || 0
      const totalDelivered = viewData.total_delivered || 0
      const deliveryRate = totalSent > 0
        ? Math.round((totalDelivered / totalSent) * 100)
        : 0

      return NextResponse.json({
        totalSent,
        totalDelivered,
        totalRead: viewData.total_read || 0,
        totalFailed: viewData.total_failed || 0,
        activeCampaigns: (viewData.active_campaigns || 0) + (viewData.scheduled_campaigns || 0),
        deliveryRate,
        // Extra stats from view
        sent24h: viewData.sent_24h || 0,
        delivered24h: viewData.delivered_24h || 0,
        failed24h: viewData.failed_24h || 0,
        chartData,
      })
    }

    // Fallback: View doesn't exist yet, use legacy query
    // This path will be removed once migration 0033 is applied
    const { data, error } = await supabase
      .from('campaigns')
      .select('sent, delivered, read, failed, status')

    if (error) throw error

    // Calculate aggregates
    let totalSent = 0
    let totalDelivered = 0
    let totalRead = 0
    let totalFailed = 0
    let activeCampaigns = 0

    const activeStatuses = new Set([
      'enviando',
      'agendado',
      'sending',
      'scheduled',
    ])

    ;(data || []).forEach(row => {
      totalSent += row.sent || 0
      totalDelivered += row.delivered || 0
      totalRead += row.read || 0
      totalFailed += row.failed || 0
      const status = String(row.status || '').trim().toLowerCase()
      if (activeStatuses.has(status)) {
        activeCampaigns++
      }
    })

    // Calculate delivery rate
    const deliveryRate = totalSent > 0
      ? Math.round((totalDelivered / totalSent) * 100)
      : 0

    return NextResponse.json({
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      activeCampaigns,
      deliveryRate,
      chartData,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
