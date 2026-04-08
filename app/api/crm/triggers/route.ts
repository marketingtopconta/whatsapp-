import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ActionSchema = z.object({
    order: z.number().int().min(0),
    actionType: z.enum(['send_template', 'send_text', 'move_stage', 'add_tag', 'assign_to', 'wait', 'mark_won', 'mark_lost', 'webhook']),
    actionConfig: z.record(z.string(), z.unknown()).default({}),
})

const CreateTriggerSchema = z.object({
    funnelId: z.string().optional().nullable(),
    stageId: z.string().optional().nullable(),
    name: z.string().min(1).max(200),
    triggerType: z.enum(['time_no_reply', 'keyword', 'stage_enter', 'stage_exit', 'deal_won', 'deal_lost', 'tag_added']),
    triggerConfig: z.record(z.string(), z.unknown()).default({}),
    actions: z.array(ActionSchema).default([]),
})

/**
 * GET /api/crm/triggers?funnelId=&stageId=
 */
export async function GET(request: NextRequest) {
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })

    const url = new URL(request.url)
    const funnelId = url.searchParams.get('funnelId')
    const stageId = url.searchParams.get('stageId')

    try {
        let query = supabase
            .from('triggers')
            .select('*, trigger_actions(*)')
            .order('created_at', { ascending: true })

        if (funnelId) query = query.eq('funnel_id', funnelId)
        if (stageId)  query = query.eq('stage_id', stageId)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json(
            (data ?? []).map((row: any) => ({
                id: row.id,
                funnelId: row.funnel_id,
                stageId: row.stage_id,
                name: row.name,
                isActive: row.is_active,
                triggerType: row.trigger_type,
                triggerConfig: row.trigger_config ?? {},
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                actions: (row.trigger_actions ?? [])
                    .sort((a: any, b: any) => a.order - b.order)
                    .map((a: any) => ({
                        id: a.id,
                        triggerId: a.trigger_id,
                        order: a.order,
                        actionType: a.action_type,
                        actionConfig: a.action_config ?? {},
                        createdAt: a.created_at,
                    })),
            }))
        )
    } catch (error) {
        console.error('[Triggers] Erro ao listar:', error)
        return NextResponse.json({ error: 'Falha ao listar triggers' }, { status: 500 })
    }
}

/**
 * POST /api/crm/triggers
 * Cria trigger + ações em transação
 */
export async function POST(request: NextRequest) {
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })

    try {
        const body = await request.json()
        const parsed = CreateTriggerSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const { actions, ...triggerData } = parsed.data

        // Cria o trigger
        const { data: trigger, error } = await supabase
            .from('triggers')
            .insert({
                funnel_id: triggerData.funnelId ?? null,
                stage_id: triggerData.stageId ?? null,
                name: triggerData.name,
                trigger_type: triggerData.triggerType,
                trigger_config: triggerData.triggerConfig,
            })
            .select()
            .single()

        if (error) throw error

        // Insere ações se houver
        if (actions.length > 0) {
            const { error: actErr } = await supabase.from('trigger_actions').insert(
                actions.map((a) => ({
                    trigger_id: trigger.id,
                    order: a.order,
                    action_type: a.actionType,
                    action_config: a.actionConfig,
                }))
            )
            if (actErr) throw actErr
        }

        // Retorna com ações incluídas
        const { data: full } = await supabase
            .from('triggers')
            .select('*, trigger_actions(*)')
            .eq('id', trigger.id)
            .single()

        return NextResponse.json(full, { status: 201 })
    } catch (error) {
        console.error('[Triggers] Erro ao criar:', error)
        return NextResponse.json({ error: 'Falha ao criar trigger' }, { status: 500 })
    }
}
