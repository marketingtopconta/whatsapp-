import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateTriggerSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
    triggerType: z.enum(['time_no_reply', 'keyword', 'stage_enter', 'stage_exit', 'deal_won', 'deal_lost', 'tag_added']).optional(),
    triggerConfig: z.record(z.string(), z.unknown()).optional(),
})

/** GET /api/crm/triggers/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })

    const { id } = await params
    const { data, error } = await supabase
        .from('triggers')
        .select('*, trigger_actions(*)')
        .eq('id', id)
        .single()

    if (error) return NextResponse.json({ error: 'Trigger não encontrado' }, { status: 404 })
    return NextResponse.json(data)
}

/** PUT /api/crm/triggers/[id] */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })

    try {
        const { id } = await params
        const body = await request.json()
        const parsed = UpdateTriggerSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
        }

        const dto = parsed.data
        const { data, error } = await supabase
            .from('triggers')
            .update({
                ...(dto.name !== undefined       && { name: dto.name }),
                ...(dto.isActive !== undefined   && { is_active: dto.isActive }),
                ...(dto.triggerType !== undefined && { trigger_type: dto.triggerType }),
                ...(dto.triggerConfig !== undefined && { trigger_config: dto.triggerConfig }),
            })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: 'Falha ao atualizar trigger' }, { status: 500 })
    }
}

/** DELETE /api/crm/triggers/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })

    const { id } = await params
    const { error } = await supabase.from('triggers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Falha ao remover trigger' }, { status: 500 })
    return NextResponse.json({ success: true })
}
