'use client'

/**
 * FunnelAutomationBoard — board de automações no mesmo estilo visual do KanbanBoard.
 * Cada coluna = um estágio, cada card = um trigger configurado.
 * Clicar em um card abre o painel de edição lateral.
 */

import { Plus, Zap, Pencil, Trash2, ToggleRight, ToggleLeft, Clock, MessageSquare, ArrowRight, Tag, CheckCircle, XCircle, AlertCircle, GripVertical } from 'lucide-react'
import type { Trigger, PipelineStage } from '@/types'

// =============================================================================
// Helpers de resumo por tipo de trigger
// =============================================================================

const TRIGGER_COLOR: Record<string, string> = {
  time_no_reply: '#f59e0b',
  keyword:       '#3b82f6',
  stage_enter:   '#10b981',
  stage_exit:    '#8b5cf6',
  deal_won:      '#22c55e',
  deal_lost:     '#ef4444',
  tag_added:     '#ec4899',
}

function triggerConditionLabel(trigger: Trigger): string {
  const cfg = trigger.triggerConfig
  switch (trigger.triggerType) {
    case 'time_no_reply':
      return `Sem resposta após ${cfg.minutes ?? '?'} min`
    case 'keyword': {
      const kw = (cfg.keywords ?? []).slice(0, 2).join(', ')
      return kw ? `Palavras: "${kw}"${(cfg.keywords?.length ?? 0) > 2 ? '…' : ''}` : 'Palavra-chave recebida'
    }
    case 'stage_enter': return 'Quando movido para esta etapa'
    case 'stage_exit':  return 'Quando sai desta etapa'
    case 'deal_won':    return 'Quando deal for ganho'
    case 'deal_lost':   return 'Quando deal for perdido'
    case 'tag_added':   return cfg.tag ? `Tag "${cfg.tag}" adicionada` : 'Tag adicionada'
    default:            return trigger.triggerType
  }
}

function actionsLabel(trigger: Trigger): string {
  const actions = (trigger.actions ?? []).sort((a, b) => a.order - b.order)
  if (actions.length === 0) return 'Sem ações'
  const labels: Record<string, string> = {
    send_template: 'Enviar template',
    send_text:     'Enviar mensagem',
    move_stage:    'Alterar etapa lead',
    add_tag:       'Adicionar tag',
    assign_to:     'Atribuir atendente',
    wait:          `Aguardar ${actions.find(a => a.actionType === 'wait')?.actionConfig?.minutes ?? '?'} min`,
    mark_won:      'Marcar como ganho',
    mark_lost:     'Marcar como perdido',
    webhook:       'Chamar webhook',
  }
  // Exibe as ações mais relevantes (não 'wait')
  const mainActions = actions.filter(a => a.actionType !== 'wait')
  if (mainActions.length === 0) return labels[actions[0]?.actionType] ?? 'Aguardar'
  return mainActions.slice(0, 2).map(a => labels[a.actionType] ?? a.actionType).join(' + ')
}

// =============================================================================
// Card de trigger — estilo DealCard
// =============================================================================

interface TriggerCardProps {
  trigger: Trigger
  stageColor: string
  onClick: (t: Trigger) => void
  onDelete: (t: Trigger) => void
  onToggle: (t: Trigger) => void
}

function TriggerCard({ trigger, stageColor, onClick, onDelete, onToggle }: TriggerCardProps) {
  const accent = TRIGGER_COLOR[trigger.triggerType] ?? stageColor
  const actions = (trigger.actions ?? []).sort((a, b) => a.order - b.order)
  const hasWait = actions.some(a => a.actionType === 'wait')
  const waitMin = actions.find(a => a.actionType === 'wait')?.actionConfig?.minutes

  return (
    <div
      className={`group relative rounded-lg border cursor-pointer select-none transition-all ${
        trigger.isActive
          ? 'bg-zinc-800 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-750'
          : 'bg-zinc-900/60 border-zinc-800/60 opacity-50 hover:opacity-70'
      }`}
      style={{ borderLeft: `3px solid ${accent}` }}
      onClick={() => onClick(trigger)}
    >
      <div className="p-3">
        {/* Status badge se inativo */}
        {!trigger.isActive && (
          <span className="absolute top-2 right-2 text-[9px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
            inativo
          </span>
        )}

        {/* Condição do trigger */}
        <p className="text-[11px] text-zinc-400 leading-tight mb-1 pr-8">
          {triggerConditionLabel(trigger)}
          {hasWait && waitMin && (
            <span className="ml-1 text-amber-400/80">· após {waitMin}min</span>
          )}
        </p>

        {/* Ação principal — destaque */}
        <p className="text-xs font-semibold text-zinc-100 leading-snug mb-2 pr-8">
          {actionsLabel(trigger)}
        </p>

        {/* Pills de ações */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {actions.slice(0, 3).map((a, i) => (
              <span
                key={i}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: accent + '18', color: accent, border: `1px solid ${accent}30` }}
              >
                {{
                  send_template: '📤 template',
                  send_text:     '💬 texto',
                  move_stage:    '➡️ mover etapa',
                  add_tag:       '🏷 tag',
                  assign_to:     '👤 atribuir',
                  wait:          `⏳ ${a.actionConfig?.minutes}min`,
                  mark_won:      '✅ ganho',
                  mark_lost:     '❌ perdido',
                  webhook:       '🔗 webhook',
                }[a.actionType] ?? a.actionType}
              </span>
            ))}
            {actions.length > 3 && (
              <span className="text-[9px] text-zinc-600 px-1 py-0.5">
                +{actions.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Ações hover — no canto inferior direito */}
      <div className="absolute bottom-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(trigger) }}
          title={trigger.isActive ? 'Desativar' : 'Ativar'}
          className="p-1 rounded hover:bg-zinc-600 transition-colors"
        >
          {trigger.isActive
            ? <ToggleRight className="h-3 w-3 text-emerald-400" />
            : <ToggleLeft className="h-3 w-3 text-zinc-400" />
          }
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(trigger) }}
          className="p-1 rounded hover:bg-red-900/50 transition-colors"
        >
          <Trash2 className="h-3 w-3 text-zinc-500 hover:text-red-400" />
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Coluna de estágio — idêntica ao KanbanColumn
// =============================================================================

interface AutomationColumnProps {
  stage: PipelineStage
  triggers: Trigger[]
  onAdd: (stageId: string) => void
  onEdit: (t: Trigger) => void
  onDelete: (t: Trigger) => void
  onToggle: (t: Trigger) => void
}

function AutomationColumn({ stage, triggers, onAdd, onEdit, onDelete, onToggle }: AutomationColumnProps) {
  const activeTriggers = triggers.filter(t => t.isActive)

  return (
    <div className="flex flex-col h-full min-w-[260px] max-w-[280px] shrink-0">
      {/* Cabeçalho — idêntico ao KanbanColumn */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <GripVertical className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <span className="text-sm font-medium text-zinc-200 truncate flex-1">
          {stage.name}
        </span>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full shrink-0">
          {activeTriggers.length}
        </span>
        {stage.isEntryStage && (
          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded shrink-0">
            entrada
          </span>
        )}
        {stage.isWonStage && (
          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded shrink-0">
            ganho
          </span>
        )}
        {stage.isLostStage && (
          <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded shrink-0">
            perdido
          </span>
        )}
      </div>

      {/* Botão adicionar — no topo, como "Adicionar dicas" da referência */}
      <button
        onClick={() => onAdd(stage.id)}
        className="mb-2 flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-emerald-400 px-2 py-1 rounded hover:bg-zinc-800/50 transition-colors w-full"
      >
        <Plus className="h-3 w-3" />
        Adicionar gatilho
      </button>

      {/* Área das automações */}
      <div className="flex-1 flex flex-col gap-2 rounded-xl p-2 min-h-[200px] bg-zinc-900/40 overflow-y-auto">
        {triggers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 border border-dashed border-zinc-800 rounded-lg py-8 gap-2">
            <AlertCircle className="h-5 w-5 opacity-30" />
            <p className="text-xs text-center px-2 leading-relaxed">
              Sem automações nesta etapa
            </p>
          </div>
        ) : (
          triggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              stageColor={stage.color ?? '#6366f1'}
              onClick={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Coluna de triggers globais (sem estágio vinculado)
// =============================================================================

interface GlobalColumnProps {
  triggers: Trigger[]
  onAdd: () => void
  onEdit: (t: Trigger) => void
  onDelete: (t: Trigger) => void
  onToggle: (t: Trigger) => void
}

function GlobalColumn({ triggers, onAdd, onEdit, onDelete, onToggle }: GlobalColumnProps) {
  if (triggers.length === 0) return null

  return (
    <div className="flex flex-col h-full min-w-[260px] max-w-[280px] shrink-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <GripVertical className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-500 shrink-0" />
        <span className="text-sm font-medium text-zinc-400 truncate flex-1">
          Qualquer etapa
        </span>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full shrink-0">
          {triggers.length}
        </span>
      </div>

      <button
        onClick={onAdd}
        className="mb-2 flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-emerald-400 px-2 py-1 rounded hover:bg-zinc-800/50 transition-colors w-full"
      >
        <Plus className="h-3 w-3" />
        Adicionar gatilho global
      </button>

      <div className="flex-1 flex flex-col gap-2 rounded-xl p-2 min-h-[200px] bg-zinc-900/40 border border-dashed border-zinc-800 overflow-y-auto">
        {triggers.map((trigger) => (
          <TriggerCard
            key={trigger.id}
            trigger={trigger}
            stageColor="#6366f1"
            onClick={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Board principal
// =============================================================================

export interface FunnelAutomationBoardProps {
  stages: PipelineStage[]
  triggers: Trigger[]
  onAdd: (stageId?: string) => void
  onEdit: (trigger: Trigger) => void
  onDelete: (trigger: Trigger) => void
  onToggle: (trigger: Trigger) => void
  isLoading?: boolean
}

export function FunnelAutomationBoard({
  stages,
  triggers,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  isLoading,
}: FunnelAutomationBoardProps) {
  const globalTriggers = triggers.filter(t => !t.stageId)

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="min-w-[260px] max-w-[280px] shrink-0">
            <div className="h-5 w-36 bg-zinc-800 rounded mb-3 animate-pulse" />
            <div className="bg-zinc-900/40 rounded-xl p-2 space-y-2 min-h-[200px]">
              {[1, 2].map(j => (
                <div key={j} className="h-20 bg-zinc-800/60 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        <div className="text-center">
          <Zap className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p>Selecione um funil com estágios configurados.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 pb-6 h-full min-h-[500px]">
      {/* Coluna global (sem estágio) — apenas se existir */}
      {globalTriggers.length > 0 && (
        <GlobalColumn
          triggers={globalTriggers}
          onAdd={() => onAdd(undefined)}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
        />
      )}

      {/* Colunas por estágio */}
      {stages.map(stage => (
        <AutomationColumn
          key={stage.id}
          stage={stage}
          triggers={triggers.filter(t => t.stageId === stage.id)}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
