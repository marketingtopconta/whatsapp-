import { NextRequest, NextResponse } from 'next/server'
import { dealDb } from '@/lib/supabase-db'
import { z } from 'zod'
import type { DealStatus } from '@/types'

export const dynamic = 'force-dynamic'

const CreateDealSchema = z.object({
    contactId: z.string().optional().nullable(),
    stageId: z.string().min(1),
    title: z.string().min(1).max(200),
    value: z.number().min(0).optional(),
    notes: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * GET /api/crm/deals
 * Lista deals com filtros opcionais: stageId, status, contactId, limit, offset
 */
export async function GET(request: NextRequest) {

    const url = new URL(request.url)
    const stageId = url.searchParams.get('stageId') || undefined
    const status = url.searchParams.get('status') as DealStatus | undefined
    const contactId = url.searchParams.get('contactId') || undefined
    const limit = Math.min(Number(url.searchParams.get('limit') || '100'), 500)
    const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0)

    try {
        const result = await dealDb.list({ stageId, status, contactId, limit, offset })
        return NextResponse.json(result)
    } catch (error) {
        console.error('[CRM] Erro ao listar deals:', error)
        return NextResponse.json({ error: 'Falha ao listar deals' }, { status: 500 })
    }
}

/**
 * POST /api/crm/deals
 * Cria um novo deal
 */
export async function POST(request: NextRequest) {

    try {
        const body = await request.json()
        const parsed = CreateDealSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const deal = await dealDb.create(parsed.data)
        return NextResponse.json(deal, { status: 201 })
    } catch (error) {
        console.error('[CRM] Erro ao criar deal:', error)
        return NextResponse.json({ error: 'Falha ao criar deal' }, { status: 500 })
    }
}
