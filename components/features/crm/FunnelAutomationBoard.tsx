'use client'

/**
 * FunnelAutomationBoard
 *
 * Visão kanban das automações por estágio do funil.
 * Cada coluna representa um estágio e exibe os triggers configurados
 * com suas ações, além de um botão para adicionar novo trigger naquele estágio.
 */

import { useState } from 'react'
import { Plus, Zap, ToggleRight, ToggleLeft, Pencil, Trash2, Clock, MessageSquare, ArrowRight, Tag, User, Webhook, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '@/components/features/crm/TriggerBuilder'
import type { Trigger, TriggerActionType, PipelineStage } from '@/types'

// =============================================================================
// Ícones por tipo de trigger
// =============================================================================

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  time_no_reply: <Clock className="h-3 w-3" />,
  keyword:       <MessageSquare className="h-3 w-3" />,
  stage_enter:   <ArrowRight className="h-3 w-3" />,
  stage_exit:    <ArrowRight className="h-3 w-3 rotate-180" />,
  deal_won:      <CheckCircle className="h-3 w-3" />,
  deal_lost:     <XCircle className="h-3 w-3" />,
  tag_added:     <Tag className="h-3 w-3" />,
}

const ACTION_ICONS: Record<TriggerActionType, React.ReactNode> = {
  send_template: <span className="text-[9px]">📤</span>,
  send_text:     <span className="text-[9px]">💬</span>,
  move_stage:    <span className="text-[9px]">➡️</span>,
  add_tag:       <span className="text-[9px]">🏷</span>,
  assign_to:     <span className="text-[9px]">👤</span>,
  wait:          <span className="text-[9px]">⏳</span>,
  mark_won:      <span className="text-[9px]">✅</span>,
  mark_lost:     <span className="text-[9px]">❌</span>,
  webhook:       <span className="text-[9px]">🔗</span>,
}

// =============================================================================
// Resumo curto de configuração do trigger
// =============================================================================

function triggerSummary(trigger: Trigger): string {
  const cfg = trigger.triggerConfig
  switch (trigger.triggerType) {
    case 'time_no_reply':
      return `Após ${cfg.minutes ?? '?'} min sem resposta`
    case 'keyword': {
      const kw = (cfg.keywords ?? []).slice(0, 3).join(', ')
      return kw ? `Palavras: ${kw}` : 'Palavras-chave'
    }
    case 'stage_enter': return 'Ao entrar neste estágio'
    case 'stage_exit':  return 'Ao sair do estágio'
    case 'deal_won':    return 'Quando deal for ganho'
    case 'deal_lost':   return 'Quando deal for perdido'
    case 'tag_added':   return cfg.tag ? `Tag: "${cfg.tag}"` : 'Tag adicionada'
    default:            return TRIGGER_TYPE_LABELS[trigger.triggerType] ?? trigger.triggerType
  }
}

// =============================================================================
// Card individual de trigger
// =============================================================================

interface TriggerCardProps {
  trigger: Trigger
  stageColor?: string
  onEdit: (t: Trigger) => void
  onDelete: (t: Trigger) => void
  onToggle: (t: Trigger) => void
}

function TriggerCard({ trigger, stageColor, onEdit, onDelete, onToggle }: TriggerCardProps) {
  const actions = trigger.actions ?? []
  const accent = stageColor ?? '#6366f1'

  return (
    <div
      className={`group relative rounded-lg border transition-all ${
        trigger.isActive
          ? 'bg-zinc-800/80 border-zinc-700 hover:border-zinc-600'
          : 'bg-zinc-900/40 border-zinc-800/50 opacity-60'
      }`}
    >
      {/* Barra colorida lateral */}
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ backgroundColor: accent }}
      />

      <div className="pl-3 pr-2 py-2.5">
        {/* Linha do tipo de trigger */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-zinc-400 shrink-0" style={{ color: accent }}>
              {TRIGGER_ICONS[trigger.triggerType] ?? <Zap className="h-3 w-3" />}
            </span>
            <span className="text-[11px] font-medium text-zinc-200 truncate leading-tight">
              {trigger.name}
            </span>
          </div>
          {/* Botões — ficam visíveis no hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => onToggle(trigger)}
              title={trigger.isActive ? 'Desativar' : 'Ativar'}
              className="p-1 rounded text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              {trigger.isActive
                ? <ToggleRight className="h-3.5 w-3.5 text-emerald-400" />
                : <ToggleLeft className="h-3.5 w-3.5" />
              }
            </button>
            <button
              onClick={() => onEdit(trigger)}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(trigger)}
              className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Condição */}
        <p className="text-[10px] text-zinc-500 mt-0.5 ml-4.5 leading-relaxed">
          {triggerSummary(trigger)}
        </p>

        {/* Ações */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 ml-4">
            {actions
              .sort((a, b) => a.order - b.order)
              .map((action, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[9px] bg-zinc-700/60 text-zinc-400 px-1.5 py-0.5 rounded"
                >
                  {ACTION_ICONS[action.actionType]}
                  <span>{ACTION_TYPE_LABELS[action.actionType]?.replace(/^[^\s]+\s/, '')}</span>
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Coluna de estágio
// =============================================================================

interface StageColumnProps {
  stage: PipelineStage
  triggers: Trigger[]
  globalTriggers?: Trigger[]
  onAdd: (stageId: string) => void
  onEdit: (t: Trigger) => void
  onDelete: (t: Trigger) => void
  onToggle: (t: Trigger) => void
}

function StageColumn({ stage, triggers, onAdd, onEdit, onDelete, onToggle }: StageColumnProps) {
  const activeTriggers = triggers.filter((t) => t.isActive)

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Cabeçalho do estágio */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.color ?? '#6366f1' }}
          />
          <span className="text-xs font-semibold text-zinc-200 truncate max-w-[160px]">
            {stage.name}
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
        <span className="text-[10px] text-zinc-600 shrink-0">
          {activeTriggers.length}/{triggers.length}
        </span>
      </div>

      {/* Área dos triggers — scroll vertical */}
      <div className="flex-1 rounded-xl bg-zinc-900/60 border border-zinc-800 p-2 space-y-1.5 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]">
        {triggers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-zinc-600">
            <AlertCircle className="h-5 w-5 mb-1 opacity-30" />
            <p className="text-[11px]">Sem automações</p>
          </div>
        ) : (
          triggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              stageColor={stage.color ?? undefined}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))
        )}
      </div>

      {/* Botão adicionar */}
      <button
        onClick={() => onAdd(stage.id)}
        className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 hover:text-emerald-400 py-2 rounded-lg border border-dashed border-zinc-700 hover:border-emerald-500/50 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Adicionar trigger
      </button>
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
  // Triggers sem estágio específico (se aplicam ao funil inteiro)
  const globalTriggers = triggers.filter((t) => !t.stageId)

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
            <div className="h-48 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <Zap className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">Selecione um funil com estágios para ver as automações.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pr-4">
      {/* Coluna de triggers globais (sem estágio vinculado) */}
      {globalTriggers.length > 0 && (
        <div className="flex flex-col w-72 shrink-0">
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-500 shrink-0" />
            <span className="text-xs font-semibold text-zinc-400">Qualquer estágio</span>
            <span className="text-[10px] text-zinc-600">{globalTriggers.length}</span>
          </div>
          <div className="flex-1 rounded-xl bg-zinc-900/60 border border-zinc-800 border-dashed p-2 space-y-1.5 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]">
            {globalTriggers.map((trigger) => (
              <TriggerCard
                key={trigger.id}
                trigger={trigger}
                stageColor="#6366f1"
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
              />
            ))}
          </div>
          <button
            onClick={() => onAdd(undefined)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 hover:text-emerald-400 py-2 rounded-lg border border-dashed border-zinc-700 hover:border-emerald-500/50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Adicionar trigger global
          </button>
        </div>
      )}

      {/* Colunas por estágio */}
      {stages.map((stage) => {
        const stageTriggers = triggers.filter((t) => t.stageId === stage.id)
        return (
          <StageColumn
            key={stage.id}
            stage={stage}
            triggers={stageTriggers}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
          />
        )
      })}
    </div>
  )
}
