import { NextRequest, NextResponse } from 'next/server'
import { dealDb } from '@/lib/supabase-db'
import { verifyApiKey } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateDealSchema = z.object({
    stageId: z.string().min(1).optional(),
    title: z.string().min(1).max(200).optional(),
    value: z.number().min(0).optional(),
    status: z.enum(['open', 'won', 'lost']).optional(),
    notes: z.string().optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
    nextActionAt: z.string().datetime().optional().nullable(),
})

/**
 * GET /api/crm/deals/[id]
 * Retorna um deal pelo ID (com contato e estágio)
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
        const deal = await dealDb.getById(id)
        if (!deal) {
            return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })
        }
        return NextResponse.json(deal)
    } catch (error) {
        console.error('[CRM] Erro ao buscar deal:', error)
        return NextResponse.json({ error: 'Falha ao buscar deal' }, { status: 500 })
    }
}

/**
 * PUT /api/crm/deals/[id]
 * Atualiza campos do deal
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
        const parsed = UpdateDealSchema.safeParse(body)
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

        const deal = await dealDb.update(id, parsed.data)
        return NextResponse.json(deal)
    } catch (error) {
        console.error('[CRM] Erro ao atualizar deal:', error)
        return NextResponse.json({ error: 'Falha ao atualizar deal' }, { status: 500 })
    }
}

/**
 * DELETE /api/crm/deals/[id]
 * Remove um deal e suas atividades (CASCADE)
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
        const existing = await dealDb.getById(id)
        if (!existing) {
            return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })
        }

        await dealDb.delete(id)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[CRM] Erro ao remover deal:', error)
        return NextResponse.json({ error: 'Falha ao remover deal' }, { status: 500 })
    }
}
