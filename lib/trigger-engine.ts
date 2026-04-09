/**
 * trigger-engine.ts
 *
 * Motor de triggers do CRM SmartZap.
 * Avalia regras configuradas por funil/estágio e executa sequências de ações.
 *
 * Pontos de entrada:
 *   evaluateTriggers(dealId, event)           → avalia e dispara triggers aplicáveis
 *   executeTriggerSequence(triggerId, dealId) → executa todas as ações de um trigger
 *   scheduleNoReplyCheck(dealId, minutes)     → agenda re-avaliação via QStash
 */

import { getSupabaseAdmin } from '@/lib/supabase'
import type { Trigger, TriggerAction, TriggerType, TriggerActionType } from '@/types'

// =============================================================================
// Tipos internos
// =============================================================================

export type TriggerEvent =
    | { type: 'stage_enter'; stageId: string; funnelId?: string }
    | { type: 'stage_exit';  stageId: string; funnelId?: string }
    | { type: 'deal_won' }
    | { type: 'deal_lost' }
    | { type: 'message_received'; text: string }
    | { type: 'no_reply_check' }
    | { type: 'tag_added'; tag: string }

export interface TriggerEngineResult {
    triggered: number
    errors: string[]
}

// =============================================================================
// Helpers de DB
// =============================================================================

function mapTrigger(row: any): Trigger {
    return {
        id: row.id,
        funnelId: row.funnel_id ?? null,
        stageId: row.stage_id ?? null,
        name: row.name,
        isActive: row.is_active ?? true,
        triggerType: row.trigger_type,
        triggerConfig: row.trigger_config ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        actions: (row.trigger_actions ?? []).map(mapAction),
    }
}

function mapAction(row: any): TriggerAction {
    return {
        id: row.id,
        triggerId: row.trigger_id,
        order: row.order,
        actionType: row.action_type,
        actionConfig: row.action_config ?? {},
        createdAt: row.created_at,
    }
}

// =============================================================================
// Avaliação de triggers
// =============================================================================

/**
 * Ponto de entrada principal.
 * Busca triggers aplicáveis ao deal e evento, e dispara execução.
 */
export async function evaluateTriggers(
    dealId: string,
    event: TriggerEvent,
    requestOrigin?: string,
): Promise<TriggerEngineResult> {
    const supabase = getSupabaseAdmin()
    if (!supabase) return { triggered: 0, errors: ['Supabase não configurado'] }

    const result: TriggerEngineResult = { triggered: 0, errors: [] }

    try {
        // Busca o deal com seu estágio e funil
        const { data: deal } = await supabase
            .from('deals')
            .select('id, stage_id, funnel_id, status, contact_id, contacts(phone)')
            .eq('id', dealId)
            .single()

        if (!deal || deal.status !== 'open') return result

        // Busca todos os triggers ativos do funil
        const { data: triggers } = await supabase
            .from('triggers')
            .select('*, trigger_actions(*)')
            .eq('is_active', true)
            .or(`funnel_id.eq.${deal.funnel_id ?? 'null'},funnel_id.is.null`)
            .order('created_at', { ascending: true })

        if (!triggers || triggers.length === 0) return result

        const mapped = triggers.map(mapTrigger)

        for (const trigger of mapped) {
            // Verifica se o trigger se aplica ao estágio atual
            if (trigger.stageId && trigger.stageId !== deal.stage_id) continue

            // Verifica se o evento corresponde ao tipo do trigger
            if (!eventMatchesTrigger(event, trigger, deal)) continue

            // Para time_no_reply, agenda via QStash em vez de executar agora
            if (trigger.triggerType === 'time_no_reply') {
                const minutes = trigger.triggerConfig.minutes ?? 30
                scheduleNoReplyCheck(dealId, trigger.id, minutes, requestOrigin).catch((e) =>
                    console.warn('[TriggerEngine] Falha ao agendar no-reply check:', e)
                )
                result.triggered++
                continue
            }

            // Executa a sequência de ações do trigger
            try {
                await executeTriggerSequence(trigger, dealId, (deal as any)?.contacts?.phone)
                result.triggered++
            } catch (e: any) {
                result.errors.push(`Trigger "${trigger.name}": ${e.message}`)
            }
        }
    } catch (e: any) {
        result.errors.push(e.message)
    }

    return result
}

/**
 * Verifica se um evento do sistema corresponde ao tipo e config do trigger.
 */
function eventMatchesTrigger(event: TriggerEvent, trigger: Trigger, deal: any): boolean {
    const cfg = trigger.triggerConfig

    switch (trigger.triggerType as TriggerType) {
        case 'stage_enter':
            return event.type === 'stage_enter'

        case 'stage_exit':
            return event.type === 'stage_exit'

        case 'deal_won':
            return event.type === 'deal_won'

        case 'deal_lost':
            return event.type === 'deal_lost'

        case 'keyword':
            if (event.type !== 'message_received') return false
            if (!cfg.keywords || cfg.keywords.length === 0) return false
            const text = event.text.toLowerCase()
            const keywords = cfg.keywords.map((k) => k.toLowerCase())
            return cfg.match === 'all'
                ? keywords.every((k) => text.includes(k))
                : keywords.some((k) => text.includes(k))

        case 'tag_added':
            return event.type === 'tag_added' && event.tag === cfg.tag

        case 'time_no_reply':
            // Sempre agenda quando trigger é avaliado (o check real ocorre no QStash)
            return event.type === 'stage_enter' || event.type === 'no_reply_check'

        default:
            return false
    }
}

// =============================================================================
// Execução de sequência de ações
// =============================================================================

/**
 * Executa todas as ações de um trigger em sequência.
 * Ações 'wait' suspendem a execução via QStash para o próximo passo.
 */
export async function executeTriggerSequence(
    trigger: Trigger,
    dealId: string,
    phone?: string,
    startFromOrder: number = 0,
): Promise<void> {
    const supabase = getSupabaseAdmin()
    if (!supabase) throw new Error('Supabase não configurado')

    // Registra início no log
    const { data: logEntry } = await supabase
        .from('trigger_execution_log')
        .insert({
            trigger_id: trigger.id,
            deal_id: dealId,
            trigger_name: trigger.name,
            status: 'running',
            started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

    const logId = logEntry?.id
    let actionsExecuted = 0

    try {
        const actions = (trigger.actions ?? [])
            .filter((a) => a.order >= startFromOrder)
            .sort((a, b) => a.order - b.order)

        // Busca dados atuais do deal
        const { data: deal } = await supabase
            .from('deals')
            .select('id, stage_id, funnel_id, title, contact_id, contacts(phone, name)')
            .eq('id', dealId)
            .single()

        if (!deal || !phone) {
            const { data: dealFull } = await supabase
                .from('deals')
                .select('id, stage_id, funnel_id, title, contact_id, contacts(phone, name)')
                .eq('id', dealId)
                .single()
            if ((dealFull as any)?.contacts?.phone) phone = (dealFull as any).contacts.phone
        }

        for (const action of actions) {
            // Ação 'wait': agenda a continuação via QStash e para aqui
            if (action.actionType === 'wait') {
                const minutes = (action.actionConfig.minutes as number) ?? 30
                await scheduleActionContinuation(dealId, trigger.id, action.order + 1, minutes)
                break // execução será retomada pelo QStash
            }

            await executeAction(action, dealId, phone ?? '', deal)
            actionsExecuted++
        }

        // Marca sucesso no log
        if (logId) {
            await supabase
                .from('trigger_execution_log')
                .update({
                    status: 'success',
                    finished_at: new Date().toISOString(),
                    actions_executed: actionsExecuted,
                })
                .eq('id', logId)
        }
    } catch (e: any) {
        if (logId) {
            await supabase
                .from('trigger_execution_log')
                .update({
                    status: 'failed',
                    finished_at: new Date().toISOString(),
                    actions_executed: actionsExecuted,
                    error_message: e.message,
                })
                .eq('id', logId)
        }
        throw e
    }
}

// =============================================================================
// Execução de ação individual
// =============================================================================

async function executeAction(
    action: TriggerAction,
    dealId: string,
    phone: string,
    deal: any,
): Promise<void> {
    const supabase = getSupabaseAdmin()!
    const cfg = action.actionConfig

    switch (action.actionType as TriggerActionType) {
        case 'send_template': {
            if (!phone || !cfg.template_name) break
            const { getWhatsAppCredentials } = await import('@/lib/whatsapp-credentials')
            const creds = await getWhatsAppCredentials()
            if (!creds?.accessToken || !creds?.phoneNumberId) break

            await fetch(
                `https://graph.facebook.com/v24.0/${creds.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${creds.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: phone,
                        type: 'template',
                        template: {
                            name: cfg.template_name,
                            language: { code: cfg.language ?? 'pt_BR' },
                        },
                    }),
                }
            )

            // Registra atividade no deal
            await supabase.from('deal_activities').insert({
                deal_id: dealId,
                type: 'whatsapp_sent',
                body: `Template "${cfg.template_name}" enviado automaticamente pelo trigger`,
                metadata: { trigger_action: action.id },
            })
            break
        }

        case 'send_text': {
            if (!phone || !cfg.text) break
            const { getWhatsAppCredentials } = await import('@/lib/whatsapp-credentials')
            const creds = await getWhatsAppCredentials()
            if (!creds?.accessToken || !creds?.phoneNumberId) break

            // Substitui variáveis simples: {{name}}, {{phone}}
            let text = String(cfg.text)
                .replace(/\{\{name\}\}/gi, deal?.contacts?.name ?? phone)
                .replace(/\{\{phone\}\}/gi, phone)

            // Substitui [LINK_APP] por link rastreável único por envio
            if (text.includes('[LINK_APP]')) {
                try {
                    const { createAppLinkToken, buildOneLinkUrl } = await import('@/lib/app-link')
                    const token = await createAppLinkToken({
                        dealId,
                        contactId: deal?.contact_id ?? null,
                        campaignName: 'trigger',
                    })
                    if (token) {
                        const trackedUrl = buildOneLinkUrl(token, phone)
                        text = text.replace(/\[LINK_APP\]/g, trackedUrl)
                    }
                } catch (e) {
                    console.warn('[TriggerEngine] Falha ao gerar link rastreável:', e)
                    // Mantém [LINK_APP] literal se falhar — não bloqueia o envio
                }
            }

            await fetch(
                `https://graph.facebook.com/v24.0/${creds.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${creds.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: phone,
                        type: 'text',
                        text: { body: text },
                    }),
                }
            )

            await supabase.from('deal_activities').insert({
                deal_id: dealId,
                type: 'whatsapp_sent',
                body: text,
                metadata: { trigger_action: action.id },
            })
            break
        }

        case 'move_stage': {
            if (!cfg.stage_id) break
            const prevStageId = deal?.stage_id
            await supabase
                .from('deals')
                .update({
                    stage_id: cfg.stage_id,
                    entered_stage_at: new Date().toISOString(),
                })
                .eq('id', dealId)

            // Fecha log de tempo no estágio anterior
            if (prevStageId) {
                const now = new Date()
                const { data: openLog } = await supabase
                    .from('stage_time_logs')
                    .select('id, entered_at')
                    .eq('deal_id', dealId)
                    .eq('stage_id', prevStageId)
                    .is('left_at', null)
                    .single()

                if (openLog) {
                    const seconds = Math.round((now.getTime() - new Date(openLog.entered_at).getTime()) / 1000)
                    await supabase
                        .from('stage_time_logs')
                        .update({ left_at: now.toISOString(), duration_seconds: seconds })
                        .eq('id', openLog.id)
                }

                // Abre novo log
                await supabase.from('stage_time_logs').insert({
                    deal_id: dealId,
                    stage_id: cfg.stage_id,
                    funnel_id: deal?.funnel_id,
                    entered_at: now.toISOString(),
                })
            }

            await supabase.from('deal_activities').insert({
                deal_id: dealId,
                type: 'stage_change',
                body: `Estágio alterado automaticamente pelo trigger`,
                metadata: { from_stage: prevStageId, to_stage: cfg.stage_id, trigger_action: action.id },
            })
            break
        }

        case 'mark_won': {
            await supabase
                .from('deals')
                .update({ status: 'won', won_at: new Date().toISOString() })
                .eq('id', dealId)
            await supabase.from('deal_activities').insert({
                deal_id: dealId,
                type: 'system',
                body: 'Deal marcado como ganho automaticamente pelo trigger',
                metadata: { trigger_action: action.id },
            })
            break
        }

        case 'mark_lost': {
            await supabase
                .from('deals')
                .update({ status: 'lost', lost_at: new Date().toISOString() })
                .eq('id', dealId)
            await supabase.from('deal_activities').insert({
                deal_id: dealId,
                type: 'system',
                body: 'Deal marcado como perdido automaticamente pelo trigger',
                metadata: { trigger_action: action.id },
            })
            break
        }

        case 'assign_to': {
            if (!cfg.name) break
            await supabase
                .from('deals')
                .update({ assigned_to: cfg.name })
                .eq('id', dealId)
            await supabase.from('deal_activities').insert({
                deal_id: dealId,
                type: 'system',
                body: `Deal atribuído a "${cfg.name}" automaticamente pelo trigger`,
                metadata: { trigger_action: action.id },
            })
            break
        }

        case 'add_tag': {
            // Registra como atividade (tags de deal são tratadas via metadados por ora)
            if (!cfg.name) break
            const { data: current } = await supabase
                .from('deals')
                .select('metadata')
                .eq('id', dealId)
                .single()

            const tags: string[] = current?.metadata?.tags ?? []
            if (!tags.includes(cfg.name)) {
                await supabase
                    .from('deals')
                    .update({ metadata: { ...(current?.metadata ?? {}), tags: [...tags, cfg.name] } })
                    .eq('id', dealId)
            }
            break
        }

        case 'webhook': {
            if (!cfg.url) break
            await fetch(String(cfg.url), {
                method: String(cfg.method ?? 'POST'),
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deal_id: dealId, phone, trigger_action: action.id }),
            })
            break
        }
    }
}

// =============================================================================
// Agendamento via QStash
// =============================================================================

/**
 * Agenda verificação de "sem resposta" após X minutos via QStash.
 */
export async function scheduleNoReplyCheck(
    dealId: string,
    triggerId: string,
    minutes: number,
    requestOrigin?: string,
): Promise<void> {
    const token = process.env.QSTASH_TOKEN
    const origin = requestOrigin ?? process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

    if (!token) return

    const delaySeconds = minutes * 60
    const url = `${origin}/api/crm/triggers/execute`

    await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(url)}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': `${delaySeconds}s`,
        },
        body: JSON.stringify({
            type: 'no_reply_check',
            dealId,
            triggerId,
        }),
    })
}

/**
 * Agenda a continuação de uma sequência de ações após ação 'wait'.
 */
export async function scheduleActionContinuation(
    dealId: string,
    triggerId: string,
    fromOrder: number,
    minutes: number,
    requestOrigin?: string,
): Promise<void> {
    const token = process.env.QSTASH_TOKEN
    const origin = requestOrigin ?? (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000')

    if (!token) return

    const url = `${origin}/api/crm/triggers/execute`

    await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(url)}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': `${minutes * 60}s`,
        },
        body: JSON.stringify({
            type: 'action_continuation',
            dealId,
            triggerId,
            fromOrder,
        }),
    })
}
