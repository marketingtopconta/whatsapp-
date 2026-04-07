import { NextRequest, NextResponse } from 'next/server'
import { dealDb, dealActivityDb } from '@/lib/supabase-db'
import { verifyApiKey } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateActivitySchema = z.object({
    type: z.enum(['note', 'call', 'whatsapp_sent', 'whatsapp_read', 'stage_change', 'system']),
    body: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * GET /api/crm/deals/[id]/activities
 * Lista todas as atividades de um deal
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

        const activities = await dealActivityDb.listByDeal(id)
        return NextResponse.json(activities)
    } catch (error) {
        console.error('[CRM] Erro ao listar atividades:', error)
        return NextResponse.json({ error: 'Falha ao listar atividades' }, { status: 500 })
    }
}

/**
 * POST /api/crm/deals/[id]/activities
 * Registra uma nova atividade no deal
 */
export async function POST(
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
        const parsed = CreateActivitySchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const deal = await dealDb.getById(id)
        if (!deal) {
            return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })
        }

        const activity = await dealActivityDb.create(id, parsed.data)
        return NextResponse.json(activity, { status: 201 })
    } catch (error) {
        console.error('[CRM] Erro ao criar atividade:', error)
        return NextResponse.json({ error: 'Falha ao criar atividade' }, { status: 500 })
    }
}
