import { NextRequest, NextResponse } from 'next/server'
import { funnelDb } from '@/lib/supabase-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateFunnelSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional().nullable(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
})

/**
 * GET /api/crm/funnels/[id]
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const funnel = await funnelDb.getById(id)
        return NextResponse.json(funnel)
    } catch (error) {
        console.error('[CRM Funnels] Erro ao buscar:', error)
        return NextResponse.json({ error: 'Funil não encontrado' }, { status: 404 })
    }
}

/**
 * PUT /api/crm/funnels/[id]
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const parsed = UpdateFunnelSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const funnel = await funnelDb.update(id, parsed.data)
        return NextResponse.json(funnel)
    } catch (error) {
        console.error('[CRM Funnels] Erro ao atualizar:', error)
        return NextResponse.json({ error: 'Falha ao atualizar funil' }, { status: 500 })
    }
}

/**
 * DELETE /api/crm/funnels/[id]
 * Bloqueia se for o funil padrão ou tiver deals abertos
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const funnel = await funnelDb.getById(id)

        if (funnel.isDefault) {
            return NextResponse.json(
                { error: 'Não é possível remover o funil padrão. Defina outro como padrão primeiro.' },
                { status: 400 }
            )
        }

        await funnelDb.delete(id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        // FK violation — tem deals vinculados
        if (error?.code === '23503') {
            return NextResponse.json(
                { error: 'Funil possui deals vinculados. Mova ou remova os deals primeiro.' },
                { status: 409 }
            )
        }
        console.error('[CRM Funnels] Erro ao remover:', error)
        return NextResponse.json({ error: 'Falha ao remover funil' }, { status: 500 })
    }
}
