/**
 * Auto-resposta fixa para canal apenas informativo (sem IA).
 *
 * Ativada pela setting `info_only_autoreply = 'true'`. Quando ativa, toda
 * mensagem recebida recebe o aviso abaixo e a IA não é acionada.
 */

import { settingsDb } from '@/lib/supabase-db'
import { redis } from '@/lib/redis'
import { sendWhatsAppMessage } from '@/lib/whatsapp-send'
import { inboxDb } from './inbox-db'

export const INFO_ONLY_AUTOREPLY_SETTING = 'info_only_autoreply'

export const INFO_ONLY_MESSAGE =
  'Este é um canal apenas para informações. Informamos que não realizamos atendimentos por aqui.\n\n' +
  'Para suporte técnico ou em caso de dúvidas, entre em contato com nossa equipe de suporte: (79) 99837-2540.'

// Evita responder várias vezes seguidas ao mesmo número
const COOLDOWN_SECONDS = 300

export async function isInfoOnlyAutoReplyEnabled(): Promise<boolean> {
  try {
    return (await settingsDb.get(INFO_ONLY_AUTOREPLY_SETTING)) === 'true'
  } catch {
    return false
  }
}

export async function sendInfoOnlyAutoReply(params: {
  conversationId: string
  phone: string
}): Promise<boolean> {
  const { conversationId, phone } = params

  if (redis) {
    try {
      const acquired = await redis.set(`info-autoreply:${phone}`, '1', { nx: true, ex: COOLDOWN_SECONDS })
      if (!acquired) return false
    } catch (err) {
      console.warn('[InfoAutoReply] Redis indisponível, enviando sem cooldown:', err)
    }
  }

  const result = await sendWhatsAppMessage({
    to: phone,
    type: 'text',
    text: INFO_ONLY_MESSAGE,
  })

  if (!result.success || !result.messageId) {
    console.warn('[InfoAutoReply] Falha ao enviar:', result.error)
    return false
  }

  await inboxDb.createMessage({
    conversation_id: conversationId,
    direction: 'outbound',
    content: INFO_ONLY_MESSAGE,
    message_type: 'text',
    whatsapp_message_id: result.messageId,
    delivery_status: 'sent',
  })

  return true
}
