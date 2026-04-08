import { NextRequest, NextResponse } from 'next/server'
import { funnelDb } from '@/lib/supabase-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateFunnelSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional().nullable(),
    isDefault: z.boolean().optional(),
})

/**
 * GET /api/crm/funnels
 * Lista todos os funis com contagem de estágios e deals abertos
 */
export async function GET() {
    try {
        const funnels = await funnelDb.getAll()
        return NextResponse.json(funnels)
    } catch (error) {
        console.error('[CRM Funnels] Erro ao listar:', error)
        return NextResponse.json({ error: 'Falha ao listar funis' }, { status: 500 })
    }
}

/**
 * POST /api/crm/funnels
 * Cria um novo funil
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = CreateFunnelSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const funnel = await funnelDb.create(parsed.data)
        return NextResponse.json(funnel, { status: 201 })
    } catch (error) {
        console.error('[CRM Funnels] Erro ao criar:', error)
        return NextResponse.json({ error: 'Falha ao criar funil' }, { status: 500 })
    }
}
