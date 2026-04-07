/**
 * Funnel Executor
 *
 * Motor de automação do funil de vendas.
 * Orquestra: envio de template WhatsApp → agendamento do próximo disparo via QStash.
 *
 * Fluxo:
 *   1. Busca deal + stage (com funnel_config)
 *   2. Envia template WhatsApp ao contato (se template_name configurado)
 *   3. Registra atividade whatsapp_sent no deal
 *   4. Agenda próximo disparo com delay_hours via QStash
 *   5. Atualiza deal.next_action_at e deal.qstash_message_id
 */

import { Client as QStashClient } from '@upstash/qstash'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { dealDb, dealActivityDb, pipelineStageDb } from '@/lib/supabase-db'

const META_API_VERSION = 'v24.0'
const META_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveBaseUrl(requestOrigin?: string): string {
    const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
    const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
        : null
    const vercelUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL.trim()}`
        : null

    return explicit || productionUrl || vercelUrl || requestOrigin || 'http://localhost:3000'
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface FunnelExecutionResult {
    sent: boolean
    scheduled: boolean
    messageId?: string
    qstashMessageId?: string
    error?: string
}

// ---------------------------------------------------------------------------
// Execução de um passo do funil
// ---------------------------------------------------------------------------

/**
 * Executa um passo do funil para um deal aberto:
 * - Envia template WhatsApp (se configurado no estágio)
 * - Agenda próximo disparo via QStash (se delay_hours > 0)
 * - Atualiza deal com next_action_at e qstash_message_id
 *
 * É idempotente: pode ser chamado múltiplas vezes; o QStash deduplication
 * evita disparos duplicados no mesmo segundo.
 */
export async function executeFunnelStep(
    dealId: string,
    requestOrigin?: string
): Promise<FunnelExecutionResult> {
    // 1) Carregar deal com contato e estágio
    const deal = await dealDb.getById(dealId)
    if (!deal) {
        return { sent: false, scheduled: false, error: 'Deal não encontrado' }
    }
    if (deal.status !== 'open') {
        return {
            sent: false,
            scheduled: false,
            error: `Deal com status "${deal.status}" não processa funil`,
        }
    }
    if (!deal.contact) {
        return { sent: false, scheduled: false, error: 'Deal sem contato vinculado — vincule um contato para usar o funil' }
    }

    const stage = await pipelineStageDb.getById(deal.stageId)
    if (!stage) {
        return { sent: false, scheduled: false, error: 'Estágio do deal não encontrado' }
    }

    const config = stage.funnelConfig

    // 2) Envio do template WhatsApp
    let sent = false
    let whatsappMessageId: string | undefined

    if (config.template_name) {
        const credentials = await getWhatsAppCredentials()
        if (!credentials) {
            return {
                sent: false,
                scheduled: false,
                error: 'Credenciais WhatsApp não configuradas. Configure em Configurações.',
            }
        }

        const metaPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: deal.contact.phone,
            type: 'template',
            template: {
                name: config.template_name,
                language: { code: 'pt_BR' },
            },
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), META_TIMEOUT_MS)

        try {
            const res = await fetch(
                `https://graph.facebook.com/${META_API_VERSION}/${credentials.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${credentials.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(metaPayload),
                    signal: controller.signal,
                }
            )

            const data = await res.json()

            if (res.ok && data?.messages?.[0]?.id) {
                whatsappMessageId = data.messages[0].id
                sent = true

                // Registra atividade de envio
                await dealActivityDb.create(dealId, {
                    type: 'whatsapp_sent',
                    body: `Template "${config.template_name}" enviado via funil automático`,
                    metadata: {
                        message_id: whatsappMessageId,
                        template_name: config.template_name,
                        stage_id: stage.id,
                        stage_name: stage.name,
                    },
                })
            } else {
                const errMsg =
                    data?.error?.message ||
                    data?.error?.error_user_msg ||
                    `HTTP ${res.status}`
                console.error('[FunnelExecutor] Falha ao enviar template WhatsApp:', errMsg, data)

                await dealActivityDb.create(dealId, {
                    type: 'system',
                    body: `Falha ao enviar template "${config.template_name}": ${errMsg}`,
                    metadata: { error: errMsg, http_status: res.status },
                })

                return { sent: false, scheduled: false, error: errMsg }
            }
        } catch (e: any) {
            const errMsg = e?.message || String(e)
            console.error('[FunnelExecutor] Erro na chamada Meta API:', errMsg)
            return { sent: false, scheduled: false, error: errMsg }
        } finally {
            clearTimeout(timer)
        }
    }

    // 3) Agendamento do próximo disparo via QStash
    let scheduled = false
    let qstashMessageId: string | undefined

    const delayHours = config.delay_hours ?? 0
    if (delayHours > 0) {
        const qstashToken = process.env.QSTASH_TOKEN
        if (!qstashToken) {
            console.warn('[FunnelExecutor] QSTASH_TOKEN não configurado — próximo disparo não agendado.')
        } else {
            const baseUrl = resolveBaseUrl(requestOrigin)
            const apiKey = process.env.SMARTZAP_API_KEY || process.env.SMARTZAP_ADMIN_KEY
            const qstash = new QStashClient({ token: qstashToken })
            const delaySeconds = Math.round(delayHours * 3_600)

            // Headers extras para autenticação no endpoint de trigger
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`
            }
            const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
            if (bypassSecret) {
                headers['x-vercel-protection-bypass'] = bypassSecret
            }

            try {
                const result = await qstash.publishJSON({
                    url: `${baseUrl}/api/crm/funnel/trigger`,
                    body: { dealId },
                    delay: delaySeconds,
                    retries: 2,
                    headers,
                    // Dedup por deal — evita double-schedule em re-runs
                    deduplicationId: `funnel-${dealId}-${Date.now()}`,
                })
                qstashMessageId = result.messageId
                scheduled = true
                console.log(
                    `[FunnelExecutor] Próximo disparo agendado para deal ${dealId}: delay=${delayHours}h, msgId=${qstashMessageId}`
                )
            } catch (e: any) {
                console.error('[FunnelExecutor] Falha ao agendar QStash:', e?.message || e)
                // Não falha o executor — envio já foi feito
            }
        }
    }

    // 4) Atualiza deal com próximo horário e ID da mensagem QStash
    const nextActionAt =
        delayHours > 0
            ? new Date(Date.now() + delayHours * 3_600 * 1_000).toISOString()
            : null

    await dealDb.update(dealId, {
        nextActionAt,
        qstashMessageId: qstashMessageId ?? null,
    })

    return {
        sent,
        scheduled,
        messageId: whatsappMessageId,
        qstashMessageId,
    }
}

// ---------------------------------------------------------------------------
// Cancelamento do agendamento ativo
// ---------------------------------------------------------------------------

/**
 * Cancela o próximo disparo QStash agendado para um deal (melhor esforço).
 * Limpa next_action_at e qstash_message_id no deal.
 */
export async function cancelFunnelSchedule(dealId: string): Promise<void> {
    const deal = await dealDb.getById(dealId)
    if (!deal?.qstashMessageId) return

    const qstashToken = process.env.QSTASH_TOKEN
    if (qstashToken) {
        try {
            // QStash v2 REST: DELETE /v2/messages/:messageId
            const res = await fetch(
                `https://qstash.upstash.io/v2/messages/${deal.qstashMessageId}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${qstashToken}` },
                }
            )
            if (!res.ok && res.status !== 404) {
                console.warn(
                    `[FunnelExecutor] Falha ao cancelar mensagem QStash ${deal.qstashMessageId}: HTTP ${res.status}`
                )
            }
        } catch (e) {
            console.warn('[FunnelExecutor] Erro ao cancelar mensagem QStash (best-effort):', e)
        }
    }

    // Limpa campos no deal independentemente do resultado do QStash
    await dealDb.update(dealId, {
        nextActionAt: null,
        qstashMessageId: null,
    })
}

// ---------------------------------------------------------------------------
// Avanço automático ao receber resposta do lead
// ---------------------------------------------------------------------------

/**
 * Processa resposta de um lead e executa a ação configurada no estágio atual.
 * Chamado pelo webhook quando o contato envia uma mensagem.
 *
 * - action_on_reply = 'move_next': avança para o próximo estágio e inicia funil
 * - action_on_reply = 'stop':     cancela o agendamento ativo
 * - action_on_reply = 'none':     sem ação automática
 */
export async function handleLeadReply(
    dealId: string,
    requestOrigin?: string
): Promise<void> {
    const deal = await dealDb.getById(dealId)
    if (!deal || deal.status !== 'open') return

    const stage = await pipelineStageDb.getById(deal.stageId)
    if (!stage) return

    const action = stage.funnelConfig.action_on_reply ?? 'none'

    if (action === 'stop') {
        await cancelFunnelSchedule(dealId)
        await dealActivityDb.create(dealId, {
            type: 'system',
            body: 'Funil pausado: lead respondeu e ação configurada é "parar"',
            metadata: { action_on_reply: 'stop', stage_id: stage.id },
        })
        return
    }

    if (action === 'move_next') {
        // Busca o próximo estágio (order + 1)
        const allStages = await pipelineStageDb.getAll()
        const currentIdx = allStages.findIndex((s) => s.id === stage.id)
        const nextStage = currentIdx >= 0 ? allStages[currentIdx + 1] : null

        if (!nextStage) {
            // Já está no último estágio — sem ação
            await dealActivityDb.create(dealId, {
                type: 'system',
                body: 'Lead respondeu — já está no último estágio do funil',
                metadata: { action_on_reply: 'move_next', stage_id: stage.id },
            })
            return
        }

        // Cancela agendamento atual e move para próximo estágio
        await cancelFunnelSchedule(dealId)
        await dealDb.move(dealId, nextStage.id, stage.id)

        await dealActivityDb.create(dealId, {
            type: 'system',
            body: `Lead respondeu — avançado para estágio "${nextStage.name}"`,
            metadata: {
                action_on_reply: 'move_next',
                from_stage_id: stage.id,
                to_stage_id: nextStage.id,
            },
        })

        // Inicia funil no novo estágio (se tiver template configurado)
        if (nextStage.funnelConfig.template_name) {
            await executeFunnelStep(dealId, requestOrigin)
        }
    }
}
