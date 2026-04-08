import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/crm/triggers/execute
 *
 * Endpoint chamado pelo QStash para:
 *   - Verificar "sem resposta" após delay (no_reply_check)
 *   - Retomar sequência de ações após um 'wait' (action_continuation)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { type, dealId, triggerId, fromOrder } = body

        if (!dealId || !triggerId) {
            return NextResponse.json({ error: 'dealId e triggerId são obrigatórios' }, { status: 400 })
        }

        const supabase = getSupabaseAdmin()
        if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })

        // Busca o deal atual
        const { data: deal } = await supabase
            .from('deals')
            .select('id, stage_id, status, contact_id, contacts(phone)')
            .eq('id', dealId)
            .single()

        // Se o deal não existe ou foi fechado, ignora
        if (!deal || deal.status !== 'open') {
            return NextResponse.json({ skipped: true, reason: 'deal não está aberto' })
        }

        // Busca o trigger
        const { data: triggerRow } = await supabase
            .from('triggers')
            .select('*, trigger_actions(*)')
            .eq('id', triggerId)
            .single()

        if (!triggerRow || !triggerRow.is_active) {
            return NextResponse.json({ skipped: true, reason: 'trigger inativo ou não encontrado' })
        }

        const { evaluateTriggers, executeTriggerSequence } = await import('@/lib/trigger-engine')

        if (type === 'no_reply_check') {
            // Verifica se o lead respondeu desde o agendamento
            const { data: lastMsg } = await supabase
                .from('inbox_messages')
                .select('created_at')
                .eq('direction', 'inbound')
                .eq('conversation_id',
                    // Busca conversation_id pelo phone
                    supabase
                        .from('inbox_conversations')
                        .select('id')
                        .eq('phone', (deal as any)?.contacts?.phone ?? '')
                        .limit(1)
                )
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
                .then((r: any) => r.data)

            // Se respondeu depois que o trigger foi agendado, ignora
            if (lastMsg?.created_at) {
                return NextResponse.json({ skipped: true, reason: 'lead respondeu' })
            }

            // Executa o trigger completo
            const trigger = {
                ...triggerRow,
                funnelId: triggerRow.funnel_id,
                stageId: triggerRow.stage_id,
                isActive: triggerRow.is_active,
                triggerType: triggerRow.trigger_type,
                triggerConfig: triggerRow.trigger_config ?? {},
                actions: (triggerRow.trigger_actions ?? []).map((a: any) => ({
                    id: a.id,
                    triggerId: a.trigger_id,
                    order: a.order,
                    actionType: a.action_type,
                    actionConfig: a.action_config ?? {},
                    createdAt: a.created_at,
                })),
            }

            await executeTriggerSequence(trigger, dealId, (deal as any)?.contacts?.phone)
            return NextResponse.json({ executed: true })
        }

        if (type === 'action_continuation') {
            // Retoma execução de sequência após 'wait'
            const trigger = {
                ...triggerRow,
                funnelId: triggerRow.funnel_id,
                stageId: triggerRow.stage_id,
                isActive: triggerRow.is_active,
                triggerType: triggerRow.trigger_type,
                triggerConfig: triggerRow.trigger_config ?? {},
                actions: (triggerRow.trigger_actions ?? []).map((a: any) => ({
                    id: a.id,
                    triggerId: a.trigger_id,
                    order: a.order,
                    actionType: a.action_type,
                    actionConfig: a.action_config ?? {},
                    createdAt: a.created_at,
                })),
            }

            await executeTriggerSequence(trigger, dealId, (deal as any)?.contacts?.phone, fromOrder ?? 0)
            return NextResponse.json({ executed: true })
        }

        return NextResponse.json({ error: 'Tipo desconhecido' }, { status: 400 })
    } catch (error: any) {
        console.error('[Triggers Execute] Erro:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
