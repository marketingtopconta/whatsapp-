'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
    TriggerType, TriggerActionType, TriggerConfig,
    TriggerActionConfig, TriggerAction, PipelineStage,
} from '@/types'

// =============================================================================
// Labels
// =============================================================================

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
    time_no_reply: '⏱ Sem resposta após X minutos',
    keyword:       '💬 Palavra-chave na mensagem',
    stage_enter:   '➡️ Entrou no estágio',
    stage_exit:    '⬅️ Saiu do estágio',
    deal_won:      '✅ Deal ganho',
    deal_lost:     '❌ Deal perdido',
    tag_added:     '🏷 Tag adicionada',
}

export const ACTION_TYPE_LABELS: Record<TriggerActionType, string> = {
    send_template: '📤 Enviar template WhatsApp',
    send_text:     '💬 Enviar mensagem de texto',
    move_stage:    '➡️ Mover para estágio',
    add_tag:       '🏷 Adicionar tag',
    assign_to:     '👤 Atribuir a atendente',
    wait:          '⏳ Aguardar X minutos',
    mark_won:      '✅ Marcar como ganho',
    mark_lost:     '❌ Marcar como perdido',
    webhook:       '🔗 Chamar webhook externo',
}

// =============================================================================
// Config do trigger (parte superior)
// =============================================================================

interface TriggerConfigEditorProps {
    triggerType: TriggerType
    config: TriggerConfig
    onChange: (cfg: TriggerConfig) => void
}

function TriggerConfigEditor({ triggerType, config, onChange }: TriggerConfigEditorProps) {
    if (triggerType === 'time_no_reply') {
        return (
            <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Após</span>
                <Input
                    type="number"
                    min={1}
                    className="w-20 h-7 text-xs"
                    value={config.minutes ?? 30}
                    onChange={(e) => onChange({ ...config, minutes: Number(e.target.value) })}
                />
                <span className="text-xs text-zinc-400">minutos sem resposta</span>
            </div>
        )
    }

    if (triggerType === 'keyword') {
        return (
            <div className="space-y-2">
                <Input
                    placeholder="palavras separadas por vírgula (ex: preço, valor, desconto)"
                    className="h-8 text-xs"
                    value={(config.keywords ?? []).join(', ')}
                    onChange={(e) =>
                        onChange({
                            ...config,
                            keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                        })
                    }
                />
                <Select
                    value={config.match ?? 'any'}
                    onValueChange={(v) => onChange({ ...config, match: v as 'any' | 'all' })}
                >
                    <SelectTrigger className="h-7 text-xs w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="any">Qualquer palavra (OU)</SelectItem>
                        <SelectItem value="all">Todas as palavras (E)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        )
    }

    if (triggerType === 'tag_added') {
        return (
            <Input
                placeholder="Nome da tag"
                className="h-8 text-xs w-48"
                value={config.tag ?? ''}
                onChange={(e) => onChange({ ...config, tag: e.target.value })}
            />
        )
    }

    return (
        <p className="text-xs text-zinc-500">
            {triggerType === 'stage_enter' && 'Dispara quando o lead entra no estágio configurado acima.'}
            {triggerType === 'stage_exit'  && 'Dispara quando o lead sai do estágio configurado acima.'}
            {triggerType === 'deal_won'    && 'Dispara quando o deal é marcado como ganho.'}
            {triggerType === 'deal_lost'   && 'Dispara quando o deal é marcado como perdido.'}
        </p>
    )
}

// =============================================================================
// Config de cada ação
// =============================================================================

interface ActionConfigEditorProps {
    actionType: TriggerActionType
    config: TriggerActionConfig
    onChange: (cfg: TriggerActionConfig) => void
    stages: PipelineStage[]
}

function ActionConfigEditor({ actionType, config, onChange, stages }: ActionConfigEditorProps) {
    const upd = (patch: Partial<TriggerActionConfig>) => onChange({ ...config, ...patch })

    switch (actionType) {
        case 'send_template':
            return (
                <div className="flex flex-col gap-1.5">
                    <Input placeholder="Nome do template" className="h-7 text-xs"
                        value={config.template_name ?? ''}
                        onChange={(e) => upd({ template_name: e.target.value })} />
                    <Input placeholder="Idioma (padrão: pt_BR)" className="h-7 text-xs w-36"
                        value={config.language ?? ''}
                        onChange={(e) => upd({ language: e.target.value })} />
                </div>
            )

        case 'send_text':
            return (
                <textarea
                    placeholder="Mensagem. Use {{name}} para nome do contato."
                    className="w-full h-20 text-xs bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={config.text ?? ''}
                    onChange={(e) => upd({ text: e.target.value })}
                />
            )

        case 'move_stage':
            return (
                <Select value={config.stage_id ?? ''} onValueChange={(v) => upd({ stage_id: v })}>
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Selecionar estágio destino" />
                    </SelectTrigger>
                    <SelectContent>
                        {stages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                    {s.name}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )

        case 'add_tag':
        case 'assign_to':
            return (
                <Input
                    placeholder={actionType === 'add_tag' ? 'Nome da tag' : 'Nome do atendente'}
                    className="h-7 text-xs w-48"
                    value={config.name ?? ''}
                    onChange={(e) => upd({ name: e.target.value })}
                />
            )

        case 'wait':
            return (
                <div className="flex items-center gap-2">
                    <Input type="number" min={1} className="w-20 h-7 text-xs"
                        value={String(config.minutes ?? 30)}
                        onChange={(e) => upd({ minutes: Number(e.target.value) })} />
                    <span className="text-xs text-zinc-400">minutos</span>
                </div>
            )

        case 'webhook':
            return (
                <Input
                    placeholder="https://exemplo.com/webhook"
                    className="h-7 text-xs"
                    value={config.url ?? ''}
                    onChange={(e) => upd({ url: e.target.value })}
                />
            )

        default:
            return null
    }
}

// =============================================================================
// Linha de ação individual
// =============================================================================

type ActionRowData = { order: number; actionType: TriggerActionType; actionConfig: TriggerActionConfig }

interface ActionRowProps {
    action: ActionRowData
    stages: PipelineStage[]
    onChange: (patch: Partial<ActionRowData>) => void
    onRemove: () => void
}

function ActionRow({ action, stages, onChange, onRemove }: ActionRowProps) {
    return (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
            <GripVertical className="h-4 w-4 text-zinc-600 mt-1 shrink-0 cursor-grab" />
            <div className="flex-1 space-y-2">
                <Select
                    value={action.actionType}
                    onValueChange={(v) => onChange({ actionType: v as TriggerActionType, actionConfig: {} })}
                >
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(Object.keys(ACTION_TYPE_LABELS) as TriggerActionType[]).map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                                {ACTION_TYPE_LABELS[t]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <ActionConfigEditor
                    actionType={action.actionType}
                    config={action.actionConfig}
                    onChange={(cfg) => onChange({ actionConfig: cfg })}
                    stages={stages}
                />
            </div>
            <button onClick={onRemove} className="p-1 text-zinc-600 hover:text-red-400 transition-colors mt-0.5">
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}

// =============================================================================
// TriggerBuilder principal
// =============================================================================

export interface TriggerBuilderValue {
    name: string
    triggerType: TriggerType
    triggerConfig: TriggerConfig
    actions: { order: number; actionType: TriggerActionType; actionConfig: TriggerActionConfig }[]
}

interface TriggerBuilderProps {
    value: TriggerBuilderValue
    onChange: (v: TriggerBuilderValue) => void
    stages: PipelineStage[]
}

export function TriggerBuilder({ value, onChange, stages }: TriggerBuilderProps) {
    const upd = (patch: Partial<TriggerBuilderValue>) => onChange({ ...value, ...patch })

    const addAction = () => {
        upd({
            actions: [
                ...value.actions,
                { order: value.actions.length, actionType: 'send_text', actionConfig: {} },
            ],
        })
    }

    const removeAction = (idx: number) =>
        upd({ actions: value.actions.filter((_, i) => i !== idx).map((a, i) => ({ ...a, order: i })) })

    const updateAction = (idx: number, patch: Partial<(typeof value.actions)[0]>) =>
        upd({ actions: value.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)) })

    return (
        <div className="space-y-4">
            {/* Nome */}
            <Input
                placeholder="Nome do trigger (ex: Follow-up 30 min)"
                value={value.name}
                onChange={(e) => upd({ name: e.target.value })}
                className="h-9"
            />

            {/* Quando (tipo) */}
            <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Quando</p>
                <Select value={value.triggerType} onValueChange={(v) => upd({ triggerType: v as TriggerType, triggerConfig: {} })}>
                    <SelectTrigger className="h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(Object.keys(TRIGGER_TYPE_LABELS) as TriggerType[]).map((t) => (
                            <SelectItem key={t} value={t}>{TRIGGER_TYPE_LABELS[t]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="pl-1">
                    <TriggerConfigEditor
                        triggerType={value.triggerType}
                        config={value.triggerConfig}
                        onChange={(cfg) => upd({ triggerConfig: cfg })}
                    />
                </div>
            </div>

            {/* Ações */}
            <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Então (em sequência)</p>
                {value.actions.length === 0 && (
                    <p className="text-xs text-zinc-600 pl-1">Nenhuma ação configurada.</p>
                )}
                <div className="space-y-2">
                    {value.actions.map((action, idx) => (
                        <ActionRow
                            key={idx}
                            action={action}
                            stages={stages}
                            onChange={(patch) => updateAction(idx, patch)}
                            onRemove={() => removeAction(idx)}
                        />
                    ))}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addAction}
                    className="w-full border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-200 mt-1"
                >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Adicionar ação
                </Button>
            </div>
        </div>
    )
}
