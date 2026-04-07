import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/auth'
import { executeFunnelStep, cancelFunnelSchedule } from '@/lib/funnel-executor'
import { dealDb } from '@/lib/supabase-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const StartFunnelSchema = z.object({
    dealId: z.string().min(1),
    restartIfActive: z.boolean().optional().default(false),
})

/**
 * POST /api/crm/funnel/start
 *
 * Inicia (ou reinicia) o funil automático para um deal.
 * - Cancela agendamento ativo se existir e restartIfActive=true
 * - Executa o primeiro passo do funil imediatamente
 *
 * Body: { dealId: string, restartIfActive?: boolean }
 */
export async function POST(request: NextRequest) {
    const auth = await verifyApiKey(request)
    if (!auth.valid) {
        return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const parsed = StartFunnelSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Dados inválidos', details: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const { dealId, restartIfActive } = parsed.data

    const deal = await dealDb.getById(dealId)
    if (!deal) {
        return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })
    }
    if (deal.status !== 'open') {
        return NextResponse.json(
            { error: `Deal com status "${deal.status}" não pode iniciar funil` },
            { status: 409 }
        )
    }

    // Se já tem um agendamento ativo e não foi pedido restart, retorna erro informativo
    if (deal.qstashMessageId && !restartIfActive) {
        return NextResponse.json(
            {
                error: 'Deal já possui funil ativo. Use restartIfActive=true para reiniciar.',
                nextActionAt: deal.nextActionAt,
                qstashMessageId: deal.qstashMessageId,
            },
            { status: 409 }
        )
    }

    // Cancela agendamento anterior (best-effort)
    if (deal.qstashMessageId) {
        await cancelFunnelSchedule(dealId)
    }

    const requestOrigin = (() => {
        const proto = request.headers.get('x-forwarded-proto') || 'https'
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
        if (!host) return undefined
        return `${proto}://${host}`
    })()

    try {
        const result = await executeFunnelStep(dealId, requestOrigin)
        return NextResponse.json({ status: 'started', ...result })
    } catch (error: any) {
        console.error('[FunnelStart] Erro ao iniciar funil:', error)
        return NextResponse.json({ error: error?.message || 'Falha ao iniciar funil' }, { status: 500 })
    }
}
