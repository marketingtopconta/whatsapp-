import { NextRequest, NextResponse } from 'next/server'
import { pipelineStageDb } from '@/lib/supabase-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateStageSchema = z.object({
    name: z.string().min(1).max(100),
    order: z.number().int().min(0).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser hex #RRGGBB').optional(),
    funnelConfig: z.object({
        template_name: z.string().optional(),
        delay_hours: z.number().min(0).optional(),
        action_on_reply: z.enum(['move_next', 'stop', 'none']).optional(),
    }).optional(),
})

/**
 * GET /api/crm/stages
 * Lista todos os estágios do pipeline
 */
export async function GET(request: NextRequest) {

    try {
        const stages = await pipelineStageDb.getAll()
        return NextResponse.json(stages)
    } catch (error) {
        console.error('[CRM] Erro ao listar estágios:', error)
        return NextResponse.json({ error: 'Falha ao listar estágios' }, { status: 500 })
    }
}

/**
 * POST /api/crm/stages
 * Cria um novo estágio
 */
export async function POST(request: NextRequest) {

    try {
        const body = await request.json()
        const parsed = CreateStageSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const stage = await pipelineStageDb.create(parsed.data)
        return NextResponse.json(stage, { status: 201 })
    } catch (error) {
        console.error('[CRM] Erro ao criar estágio:', error)
        return NextResponse.json({ error: 'Falha ao criar estágio' }, { status: 500 })
    }
}
