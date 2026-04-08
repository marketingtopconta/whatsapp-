import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ActionSchema = z.object({
    order: z.number().int().min(0),
    actionType: z.enum(['send_template', 'send_text', 'move_stage', 'add_tag', 'assign_to', 'wait', 'mark_won', 'mark_lost', 'webhook']),
    actionConfig: z.record(z.string(), z.unknown()).default({}),
})

/**
 * PUT /api/crm/triggers/[id]/actions
 * Substitui todas as ações do trigger (upsert completo)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })

    try {
        const { id } = await params
        const body = await request.json()
        const parsed = z.array(ActionSchema).safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
        }

        // Remove todas as ações existentes
        await supabase.from('trigger_actions').delete().eq('trigger_id', id)

        // Insere as novas
        if (parsed.data.length > 0) {
            const { error } = await supabase.from('trigger_actions').insert(
                parsed.data.map((a) => ({
                    trigger_id: id,
                    order: a.order,
                    action_type: a.actionType,
                    action_config: a.actionConfig,
                }))
            )
            if (error) throw error
        }

        const { data } = await supabase
            .from('trigger_actions')
            .select('*')
            .eq('trigger_id', id)
            .order('order', { ascending: true })

        return NextResponse.json(data ?? [])
    } catch (error) {
        console.error('[Triggers] Erro ao atualizar ações:', error)
        return NextResponse.json({ error: 'Falha ao atualizar ações' }, { status: 500 })
    }
}
