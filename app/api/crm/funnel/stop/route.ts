import { NextRequest, NextResponse } from 'next/server'
import { cancelFunnelSchedule } from '@/lib/funnel-executor'
import { dealDb, dealActivityDb } from '@/lib/supabase-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const StopFunnelSchema = z.object({
    dealId: z.string().min(1),
    reason: z.string().optional(),
})

/**
 * POST /api/crm/funnel/stop
 *
 * Para o funil automático de um deal:
 * - Cancela a mensagem QStash agendada
 * - Limpa next_action_at e qstash_message_id
 * - Registra atividade de sistema
 *
 * Body: { dealId: string, reason?: string }
 */
export async function POST(request: NextRequest) {

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const parsed = StopFunnelSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Dados inválidos', details: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const { dealId, reason } = parsed.data

    const deal = await dealDb.getById(dealId)
    if (!deal) {
        return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })
    }

    if (!deal.qstashMessageId && !deal.nextActionAt) {
        return NextResponse.json({ status: 'no_active_funnel', message: 'Deal não possui funil ativo' })
    }

    try {
        await cancelFunnelSchedule(dealId)

        await dealActivityDb.create(dealId, {
            type: 'system',
            body: reason ? `Funil parado: ${reason}` : 'Funil parado manualmente',
            metadata: { action: 'funnel_stopped', reason: reason ?? null },
        })

        return NextResponse.json({ status: 'stopped' })
    } catch (error: any) {
        console.error('[FunnelStop] Erro ao parar funil:', error)
        return NextResponse.json({ error: error?.message || 'Falha ao parar funil' }, { status: 500 })
    }
}
