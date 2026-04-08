import { NextRequest, NextResponse } from 'next/server'
import { funnelDb } from '@/lib/supabase-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const DuplicateSchema = z.object({
    name: z.string().min(1).max(100),
})

/**
 * POST /api/crm/funnels/[id]/duplicate
 * Clona um funil com todos os seus estágios (sem os deals)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const parsed = DuplicateSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Informe um nome para o funil duplicado' },
                { status: 400 }
            )
        }

        const newFunnel = await funnelDb.duplicate(id, parsed.data.name)
        return NextResponse.json(newFunnel, { status: 201 })
    } catch (error) {
        console.error('[CRM Funnels] Erro ao duplicar:', error)
        return NextResponse.json({ error: 'Falha ao duplicar funil' }, { status: 500 })
    }
}
