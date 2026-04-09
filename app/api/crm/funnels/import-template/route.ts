import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { FUNNEL_TEMPLATES } from '@/lib/funnel-templates'
import type { FunnelTemplateStage, FunnelTemplateTrigger } from '@/lib/funnel-templates'

export const dynamic = 'force-dynamic'

/**
 * Mapeia o triggerType do template para o tipo do banco de dados.
 * Template usa nomes semânticos; DB usa os tipos do motor de triggers.
 */
function mapTriggerType(templateType: string): string {
  switch (templateType) {
    case 'no_reply':        return 'time_no_reply'
    case 'message_received': return 'keyword'
    default:                return templateType // stage_enter, stage_exit, deal_won, deal_lost, tag_added
  }
}

/**
 * POST /api/crm/funnels/import-template
 * Importa um template de funil pré-configurado.
 *
 * Body: { templateId: string, funnelName?: string }
 *
 * Processo:
 *   1. Localiza o template em FUNNEL_TEMPLATES
 *   2. Cria o funil no banco
 *   3. Cria os estágios e constrói mapa nome→id
 *   4. Para cada estágio, cria os triggers e ações
 *      – resolve stage_name → stage_id nos move_stage configs
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  try {
    const body = await request.json()
    const { templateId, funnelName } = body as { templateId: string; funnelName?: string }

    // 1. Localiza template
    const template = FUNNEL_TEMPLATES.find((t) => t.id === templateId)
    if (!template) {
      return NextResponse.json({ error: `Template "${templateId}" não encontrado` }, { status: 404 })
    }

    const finalName = funnelName?.trim() || template.name

    // Verifica se já existe funil com esse nome para evitar duplicata acidental
    const { data: existing } = await supabase
      .from('funnels')
      .select('id')
      .eq('name', finalName)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `Já existe um funil com o nome "${finalName}". Escolha um nome diferente.` },
        { status: 409 }
      )
    }

    // 2. Cria o funil
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .insert({
        name: finalName,
        description: template.description,
        is_default: false,
        is_active: true,
      })
      .select('id')
      .single()

    if (funnelError || !funnel) {
      throw new Error(funnelError?.message ?? 'Erro ao criar funil')
    }

    const funnelId = funnel.id

    // 3. Cria os estágios em ordem e constrói mapa nome → id
    const stageNameToId: Record<string, string> = {}

    const sortedStages = [...template.stages].sort((a, b) => a.order - b.order)

    for (const stageTpl of sortedStages) {
      const { data: stage, error: stageError } = await supabase
        .from('pipeline_stages')
        .insert({
          name: stageTpl.name,
          color: stageTpl.color,
          order: stageTpl.order,
          funnel_id: funnelId,
          funnel_config: {},
          is_entry_stage: stageTpl.isEntryStage ?? false,
          is_won_stage: stageTpl.isWonStage ?? false,
          is_lost_stage: stageTpl.isLostStage ?? false,
        })
        .select('id')
        .single()

      if (stageError || !stage) {
        throw new Error(`Erro ao criar estágio "${stageTpl.name}": ${stageError?.message}`)
      }

      stageNameToId[stageTpl.name] = stage.id
    }

    // 4. Cria triggers e ações por estágio
    let triggersCreated = 0
    let actionsCreated = 0

    for (const stageTpl of sortedStages) {
      const stageId = stageNameToId[stageTpl.name]

      for (const triggerTpl of stageTpl.triggers) {
        const dbTriggerType = mapTriggerType(triggerTpl.triggerType)

        // Configura o trigger_config conforme o tipo
        let triggerConfig: Record<string, any> = { ...triggerTpl.triggerConfig }

        // Para message_received/keyword: usa o campo 'keywords'
        if (triggerTpl.triggerType === 'message_received' && triggerTpl.triggerConfig.keywords) {
          triggerConfig = {
            keywords: triggerTpl.triggerConfig.keywords,
            match: 'any',
          }
        }

        const { data: trigger, error: triggerError } = await supabase
          .from('triggers')
          .insert({
            funnel_id: funnelId,
            stage_id: stageId,
            name: triggerTpl.name,
            is_active: true,
            trigger_type: dbTriggerType,
            trigger_config: triggerConfig,
          })
          .select('id')
          .single()

        if (triggerError || !trigger) {
          throw new Error(`Erro ao criar trigger "${triggerTpl.name}": ${triggerError?.message}`)
        }

        triggersCreated++

        // Cria as ações do trigger
        const sortedActions = [...triggerTpl.actions].sort((a, b) => a.order - b.order)

        for (const actionTpl of sortedActions) {
          // Resolve stage_name → stage_id para ações move_stage
          let actionConfig: Record<string, any> = { ...actionTpl.actionConfig }

          if (actionTpl.actionType === 'move_stage' && actionConfig.stage_name) {
            const resolvedId = stageNameToId[actionConfig.stage_name]
            if (resolvedId) {
              actionConfig = { stage_id: resolvedId }
            } else {
              // Nome não encontrado no template — registra mas mantém o stage_name como fallback
              console.warn(
                `[ImportTemplate] stage_name "${actionConfig.stage_name}" não encontrado nos estágios do template`
              )
              actionConfig = { stage_id: null, stage_name: actionConfig.stage_name }
            }
          }

          const { error: actionError } = await supabase
            .from('trigger_actions')
            .insert({
              trigger_id: trigger.id,
              order: actionTpl.order,
              action_type: actionTpl.actionType,
              action_config: actionConfig,
            })

          if (actionError) {
            throw new Error(
              `Erro ao criar ação (ordem ${actionTpl.order}) do trigger "${triggerTpl.name}": ${actionError.message}`
            )
          }

          actionsCreated++
        }
      }
    }

    return NextResponse.json({
      success: true,
      funnelId,
      funnelName: finalName,
      stagesCreated: sortedStages.length,
      triggersCreated,
      actionsCreated,
    })
  } catch (error: any) {
    console.error('[ImportTemplate] Erro:', error)
    return NextResponse.json({ error: error.message ?? 'Erro interno' }, { status: 500 })
  }
}
