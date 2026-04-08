import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/crm/triggers/log?dealId=&triggerId=&status=&limit=
 */
export async function GET(request: NextRequest) {
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })

    const url = new URL(request.url)
    const dealId    = url.searchParams.get('dealId')
    const triggerId = url.searchParams.get('triggerId')
    const status    = url.searchParams.get('status')
    const limit     = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200)

    try {
        let query = supabase
            .from('trigger_execution_log')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit)

        if (dealId)    query = query.eq('deal_id', dealId)
        if (triggerId) query = query.eq('trigger_id', triggerId)
        if (status)    query = query.eq('status', status)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json(
            (data ?? []).map((row: any) => ({
                id: row.id,
                triggerId: row.trigger_id,
                dealId: row.deal_id,
                triggerName: row.trigger_name,
                status: row.status,
                startedAt: row.started_at,
                finishedAt: row.finished_at,
                actionsExecuted: row.actions_executed,
                errorMessage: row.error_message,
                metadata: row.metadata ?? {},
            }))
        )
    } catch (error) {
        console.error('[Triggers Log] Erro:', error)
        return NextResponse.json({ error: 'Falha ao buscar log' }, { status: 500 })
    }
}
