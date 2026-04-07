import { NextRequest, NextResponse } from 'next/server'
import { pipelineStageDb } from '@/lib/supabase-db'
import { verifyApiKey } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateStageSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    order: z.number().int().min(0).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser hex #RRGGBB').optional(),
    funnelConfig: z.object({
        template_name: z.string().optional(),
        delay_hours: z.number().min(0).optional(),
        action_on_reply: z.enum(['move_next', 'stop', 'none']).optional(),
    }).optional(),
})

/**
 * GET /api/crm/stages/[id]
 * Retorna um estágio pelo ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyApiKey(request)
    if (!auth.valid) {
        return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { id } = await params

    try {
        const stage = await pipelineStageDb.getById(id)
        if (!stage) {
            return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
        }
        return NextResponse.json(stage)
    } catch (error) {
        console.error('[CRM] Erro ao buscar estágio:', error)
        return NextResponse.json({ error: 'Falha ao buscar estágio' }, { status: 500 })
    }
}

/**
 * PUT /api/crm/stages/[id]
 * Atualiza um estágio
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyApiKey(request)
    if (!auth.valid) {
        return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const parsed = UpdateStageSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const existing = await pipelineStageDb.getById(id)
        if (!existing) {
            return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
        }

        const stage = await pipelineStageDb.update(id, parsed.data)
        return NextResponse.json(stage)
    } catch (error) {
        console.error('[CRM] Erro ao atualizar estágio:', error)
        return NextResponse.json({ error: 'Falha ao atualizar estágio' }, { status: 500 })
    }
}

/**
 * DELETE /api/crm/stages/[id]
 * Remove um estágio (falha se houver deals vinculados)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyApiKey(request)
    if (!auth.valid) {
        return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { id } = await params

    try {
        const existing = await pipelineStageDb.getById(id)
        if (!existing) {
            return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
        }

        await pipelineStageDb.delete(id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        // FK violation: estágio possui deals vinculados
        if (error?.code === '23503') {
            return NextResponse.json(
                { error: 'Estágio possui deals vinculados. Mova ou remova os deals antes de excluir.' },
                { status: 409 }
            )
        }
        console.error('[CRM] Erro ao remover estágio:', error)
        return NextResponse.json({ error: 'Falha ao remover estágio' }, { status: 500 })
    }
}
