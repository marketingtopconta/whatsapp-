/**
 * Templates de funil pré-configurados com estágios e triggers completos.
 * Cada template define um funil inteiro pronto para importar em um clique.
 *
 * [LINK_APP]  → substituído automaticamente pelo link rastreável gerado no envio
 * {{name}}    → substituído pelo nome do contato
 * {{phone}}   → substituído pelo telefone
 */

export interface FunnelTemplateAction {
  order: number
  actionType: string
  actionConfig: Record<string, any>
}

export interface FunnelTemplateTrigger {
  name: string
  triggerType: string
  triggerConfig: Record<string, any>
  actions: FunnelTemplateAction[]
}

export interface FunnelTemplateStage {
  name: string
  color: string
  order: number
  isEntryStage?: boolean
  isWonStage?: boolean
  isLostStage?: boolean
  triggers: FunnelTemplateTrigger[]
}

export interface FunnelTemplate {
  id: string
  name: string
  description: string
  icon: string
  stages: FunnelTemplateStage[]
}

// =============================================================================
// Funil: Tráfego Pago → Download do App
// =============================================================================

export const TRAFEGO_PAGO_TEMPLATE: FunnelTemplate = {
  id: 'trafego-pago-app',
  name: 'Tráfego Pago → App',
  description: 'Funil completo para converter leads de anúncios em usuários do app. Do primeiro contato até a conta aberta.',
  icon: '📱',
  stages: [
    // -------------------------------------------------------------------------
    // 1. NOVO LEAD
    // -------------------------------------------------------------------------
    {
      name: 'Novo Lead',
      color: '#f59e0b',
      order: 1,
      isEntryStage: true,
      triggers: [
        {
          name: 'Boas-vindas automático',
          triggerType: 'stage_enter',
          triggerConfig: {},
          actions: [
            {
              order: 1,
              actionType: 'wait',
              actionConfig: { minutes: 1 },
            },
            {
              order: 2,
              actionType: 'send_text',
              actionConfig: {
                text:
                  'Olá, {{name}}! 😊\n\nAqui é da ToiConta!\n\nVi que você tem interesse em antecipar seu salário de forma rápida e segura.\n\nPosso te explicar como funciona em menos de 2 minutos?\n\nMe responde aqui! 👇',
              },
            },
          ],
        },
        {
          name: 'Follow-up 45min sem resposta',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 45 },
          actions: [
            {
              order: 1,
              actionType: 'send_text',
              actionConfig: {
                text:
                  'Oi, {{name}}! 👋\n\nAinda estou aqui caso queira saber mais sobre a antecipação do seu salário pela ToiConta.\n\nÉ rápido, seguro e sem burocracia! 🚀\n\nQual é a sua maior dúvida?',
              },
            },
          ],
        },
        {
          name: 'Follow-up 24h sem resposta',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 1440 },
          actions: [
            {
              order: 1,
              actionType: 'send_text',
              actionConfig: {
                text:
                  '{{name}}, uma última mensagem! 🎯\n\nMuita gente já antecipou o salário hoje pela ToiConta e o dinheiro caiu na hora.\n\nQuer tentar agora? Me fala um "sim" e te envio como fazer! ✅',
              },
            },
          ],
        },
        {
          name: 'Arquivar após 3 dias sem resposta',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 4320 },
          actions: [
            {
              order: 1,
              actionType: 'move_stage',
              actionConfig: { stage_name: 'Não Converteu' },
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // 2. RESPONDEU
    // -------------------------------------------------------------------------
    {
      name: 'Respondeu',
      color: '#3b82f6',
      order: 2,
      triggers: [
        {
          name: 'Enviar link do app ao engajar',
          triggerType: 'stage_enter',
          triggerConfig: {},
          actions: [
            {
              order: 1,
              actionType: 'wait',
              actionConfig: { minutes: 3 },
            },
            {
              order: 2,
              actionType: 'send_text',
              actionConfig: {
                text:
                  'Ótimo, {{name}}! 🎉\n\nA ToiConta é 100% pelo app — simples e seguro.\n\n📲 Baixe agora:\n[LINK_APP]\n\nDemora menos de 3 minutos para criar sua conta e já pode antecipar!\n\nQualquer dúvida, me chama aqui. 😊',
              },
            },
          ],
        },
        {
          name: 'Follow-up 2h após link enviado',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 120 },
          actions: [
            {
              order: 1,
              actionType: 'send_text',
              actionConfig: {
                text:
                  'Oi! Conseguiu acessar o link do app? 📱\n\nSe tiver alguma dificuldade, me fala aqui que te ajudo na hora! 👇',
              },
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // 3. LINK ENVIADO
    // -------------------------------------------------------------------------
    {
      name: 'Link Enviado',
      color: '#8b5cf6',
      order: 3,
      triggers: [
        {
          name: 'Detectar confirmação de download',
          triggerType: 'message_received',
          triggerConfig: {
            keywords: ['baixei', 'instalei', 'conta', 'abri', 'sim', 'consegui', 'funcionou', 'pronto', 'ok', 'feito', 'criei', 'cadastro'],
          },
          actions: [
            {
              order: 1,
              actionType: 'move_stage',
              actionConfig: { stage_name: 'Conta Aberta' },
            },
          ],
        },
        {
          name: 'Reengajamento 1h sem ação',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 60 },
          actions: [
            {
              order: 1,
              actionType: 'send_text',
              actionConfig: {
                text:
                  'Oi, {{name}}! Está conseguindo baixar o app? 🤔\n\nSe preferir, te mando o link de novo:\n[LINK_APP]\n\nEstou aqui para ajudar! 💬',
              },
            },
          ],
        },
        {
          name: 'Última chance 24h',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 1440 },
          actions: [
            {
              order: 1,
              actionType: 'send_text',
              actionConfig: {
                text:
                  '⏰ {{name}}, não perca essa oportunidade!\n\nSeu salário pode chegar HOJE na sua conta — é só baixar o app:\n[LINK_APP]\n\nJá são mais de 50 mil pessoas antecipando pelo app! 🚀',
              },
            },
          ],
        },
        {
          name: 'Arquivar após 5 dias sem ação',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 7200 },
          actions: [
            {
              order: 1,
              actionType: 'move_stage',
              actionConfig: { stage_name: 'Não Converteu' },
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // 4. CLICOU NO LINK
    // -------------------------------------------------------------------------
    {
      name: 'Clicou no Link',
      color: '#f97316',
      order: 4,
      triggers: [
        {
          name: 'Mensagem de incentivo pós-clique',
          triggerType: 'stage_enter',
          triggerConfig: {},
          actions: [
            {
              order: 1,
              actionType: 'wait',
              actionConfig: { minutes: 10 },
            },
            {
              order: 2,
              actionType: 'send_text',
              actionConfig: {
                text:
                  'Ótimo, {{name}}! 🎉 Você chegou até a loja do app!\n\nAgora é só clicar em "Instalar" e criar sua conta em 3 minutos.\n\nAssim que criar, me manda um "pronto" aqui! 😊',
              },
            },
          ],
        },
        {
          name: 'Detectar confirmação de conta',
          triggerType: 'message_received',
          triggerConfig: {
            keywords: ['pronto', 'ok', 'feito', 'criei', 'baixei', 'instalei', 'conta', 'abri', 'sim', 'consegui'],
          },
          actions: [
            {
              order: 1,
              actionType: 'move_stage',
              actionConfig: { stage_name: 'Conta Aberta' },
            },
          ],
        },
        {
          name: 'Suporte 2h após clique',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 120 },
          actions: [
            {
              order: 1,
              actionType: 'send_text',
              actionConfig: {
                text:
                  'Oi! Está tendo alguma dificuldade para criar a conta? 🤔\n\nPosso te ajudar agora mesmo! Me conta o que aconteceu. 👇',
              },
            },
          ],
        },
        {
          name: 'Arquivar após 7 dias sem ação',
          triggerType: 'no_reply',
          triggerConfig: { minutes: 10080 },
          actions: [
            {
              order: 1,
              actionType: 'move_stage',
              actionConfig: { stage_name: 'Não Converteu' },
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // 5. CONTA ABERTA ← WON
    // -------------------------------------------------------------------------
    {
      name: 'Conta Aberta',
      color: '#10b981',
      order: 5,
      isWonStage: true,
      triggers: [
        {
          name: 'Parabéns + próximos passos',
          triggerType: 'stage_enter',
          triggerConfig: {},
          actions: [
            {
              order: 1,
              actionType: 'mark_won',
              actionConfig: {},
            },
            {
              order: 2,
              actionType: 'wait',
              actionConfig: { minutes: 2 },
            },
            {
              order: 3,
              actionType: 'send_text',
              actionConfig: {
                text:
                  'Parabéns, {{name}}! 🎉🎉🎉\n\nSua conta na ToiConta está pronta!\n\nAgora você pode:\n✅ Antecipar até 40% do seu salário\n✅ Receber na hora, no Pix\n✅ Sem burocracia e 100% online\n\nSeja bem-vindo(a) à família ToiConta! 💚\n\nQualquer dúvida, pode me chamar aqui. 😊',
              },
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // 6. NÃO CONVERTEU ← LOST
    // -------------------------------------------------------------------------
    {
      name: 'Não Converteu',
      color: '#ef4444',
      order: 6,
      isLostStage: true,
      triggers: [
        {
          name: 'Marcar como perdido',
          triggerType: 'stage_enter',
          triggerConfig: {},
          actions: [
            {
              order: 1,
              actionType: 'mark_lost',
              actionConfig: {},
            },
          ],
        },
      ],
    },
  ],
}

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [TRAFEGO_PAGO_TEMPLATE]
