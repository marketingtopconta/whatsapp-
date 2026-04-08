import { NextRequest, NextResponse } from 'next/server'
import { dealDb } from '@/lib/supabase-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const MoveDealSchema = z.object({
    stageId: z.string().min(1),
})

/**
 * POST /api/crm/deals/[id]/move
 * Move um deal para outro estágio e registra atividade de mudança
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {

    const { id } = await params

    try {
        const body = await request.json()
        const parsed = MoveDealSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const existing = await dealDb.getById(id)
        if (!existing) {
            return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })
        }

        if (existing.stageId === parsed.data.stageId) {
            return NextResponse.json(existing)
        }

        const deal = await dealDb.move(id, parsed.data.stageId, existing.stageId)

        // Dispara triggers de stage_exit (estágio anterior) e stage_enter (novo) — best-effort
        const { evaluateTriggers } = await import('@/lib/trigger-engine')
        const origin = request.nextUrl.origin
        evaluateTriggers(id, { type: 'stage_exit', stageId: existing.stageId, funnelId: existing.funnelId ?? undefined }, origin)
            .catch((e) => console.warn('[MoveDeal] Falha ao disparar stage_exit:', e))
        evaluateTriggers(id, { type: 'stage_enter', stageId: parsed.data.stageId, funnelId: existing.funnelId ?? undefined }, origin)
            .catch((e) => console.warn('[MoveDeal] Falha ao disparar stage_enter:', e))

        return NextResponse.json(deal)
    } catch (error) {
        console.error('[CRM] Erro ao mover deal:', error)
        return NextResponse.json({ error: 'Falha ao mover deal' }, { status: 500 })
    }
}
