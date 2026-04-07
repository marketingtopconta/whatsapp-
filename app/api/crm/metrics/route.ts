import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export interface StageMetric {
    stage_id: string
    stage_name: string
    stage_order: number
    stage_color: string
    open_count: number
    won_count: number
    lost_count: number
    open_value: number
    won_value: number
}

export interface PipelineMetricsResponse {
    stages: StageMetric[]
    totals: {
        open_count: number
        won_count: number
        lost_count: number
        open_value: number
        won_value: number
        conversion_rate: number
    }
}

/**
 * GET /api/crm/metrics
 *
 * Retorna métricas agregadas do pipeline:
 * - por estágio (open/won/lost count e valor)
 * - totais consolidados + taxa de conversão
 *
 * Chamado pelo dashboard e pelo widget de funil.
 */
export async function GET(request: NextRequest) {

    try {
        const supabase = getSupabaseAdmin()
        if (!supabase) {
            return NextResponse.json({ error: 'Banco de dados não configurado' }, { status: 503 })
        }

        // Chama RPC criada na migration 20260407000001
        const { data, error } = await supabase.rpc('get_pipeline_stage_metrics')

        if (error) {
            // Se a RPC ainda não existe (migration pendente), faz fallback manual
            if (error.code === '42883') {
                return fallbackMetrics(supabase)
            }
            throw error
        }

        const stages: StageMetric[] = Array.isArray(data) ? data : []

        const totals = stages.reduce(
            (acc, s) => ({
                open_count: acc.open_count + s.open_count,
                won_count: acc.won_count + s.won_count,
                lost_count: acc.lost_count + s.lost_count,
                open_value: acc.open_value + s.open_value,
                won_value: acc.won_value + s.won_value,
            }),
            { open_count: 0, won_count: 0, lost_count: 0, open_value: 0, won_value: 0 }
        )

        const closedTotal = totals.won_count + totals.lost_count
        const conversion_rate =
            closedTotal > 0 ? Math.round((totals.won_count / closedTotal) * 100) : 0

        const response: PipelineMetricsResponse = {
            stages,
            totals: { ...totals, conversion_rate },
        }

        return NextResponse.json(response, {
            headers: { 'Cache-Control': 'no-store' },
        })
    } catch (error: any) {
        console.error('[CRM Metrics] Erro:', error)
        return NextResponse.json({ error: 'Falha ao buscar métricas do funil' }, { status: 500 })
    }
}

// Fallback quando a RPC ainda não está disponível no banco
async function fallbackMetrics(supabase: any): Promise<NextResponse> {
    const [stagesRes, dealsRes] = await Promise.all([
        supabase.from('pipeline_stages').select('*').order('order'),
        supabase.from('deals').select('stage_id, status, value'),
    ])

    if (stagesRes.error || dealsRes.error) {
        return NextResponse.json({ stages: [], totals: { open_count: 0, won_count: 0, lost_count: 0, open_value: 0, won_value: 0, conversion_rate: 0 } })
    }

    const dealsByStage = new Map<string, { open_count: number; won_count: number; lost_count: number; open_value: number; won_value: number }>()

    for (const deal of (dealsRes.data || [])) {
        const entry = dealsByStage.get(deal.stage_id) ?? { open_count: 0, won_count: 0, lost_count: 0, open_value: 0, won_value: 0 }
        if (deal.status === 'open') { entry.open_count++; entry.open_value += Number(deal.value ?? 0) }
        if (deal.status === 'won') { entry.won_count++; entry.won_value += Number(deal.value ?? 0) }
        if (deal.status === 'lost') { entry.lost_count++ }
        dealsByStage.set(deal.stage_id, entry)
    }

    const stages: StageMetric[] = (stagesRes.data || []).map((s: any) => ({
        stage_id: s.id,
        stage_name: s.name,
        stage_order: s.order,
        stage_color: s.color,
        ...(dealsByStage.get(s.id) ?? { open_count: 0, won_count: 0, lost_count: 0, open_value: 0, won_value: 0 }),
    }))

    const totals = stages.reduce(
        (acc, s) => ({
            open_count: acc.open_count + s.open_count,
            won_count: acc.won_count + s.won_count,
            lost_count: acc.lost_count + s.lost_count,
            open_value: acc.open_value + s.open_value,
            won_value: acc.won_value + s.won_value,
        }),
        { open_count: 0, won_count: 0, lost_count: 0, open_value: 0, won_value: 0 }
    )
    const closedTotal = totals.won_count + totals.lost_count
    const conversion_rate = closedTotal > 0 ? Math.round((totals.won_count / closedTotal) * 100) : 0

    return NextResponse.json({ stages, totals: { ...totals, conversion_rate } })
}
