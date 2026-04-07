'use client'

import { useState, useEffect } from 'react'
import { Save, ChevronDown, ChevronUp, Clock, MessageSquare, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { PipelineStage, FunnelStageConfig, DealActionOnReply } from '@/types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface StageConfigPanelProps {
    stage: PipelineStage
    onSave: (stageId: string, config: FunnelStageConfig) => void
    isSaving?: boolean
}

// ---------------------------------------------------------------------------
// Labels de ação ao responder
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<DealActionOnReply, string> = {
    none: 'Nenhuma ação',
    move_next: 'Avançar para o próximo estágio',
    stop: 'Parar funil',
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function StageConfigPanel({ stage, onSave, isSaving }: StageConfigPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [config, setConfig] = useState<FunnelStageConfig>({
        template_name: stage.funnelConfig.template_name ?? '',
        delay_hours: stage.funnelConfig.delay_hours ?? 24,
        action_on_reply: stage.funnelConfig.action_on_reply ?? 'none',
    })
    const [isDirty, setIsDirty] = useState(false)

    // Sincroniza quando o estágio externo muda
    useEffect(() => {
        setConfig({
            template_name: stage.funnelConfig.template_name ?? '',
            delay_hours: stage.funnelConfig.delay_hours ?? 24,
            action_on_reply: stage.funnelConfig.action_on_reply ?? 'none',
        })
        setIsDirty(false)
    }, [stage.funnelConfig])

    function update<K extends keyof FunnelStageConfig>(key: K, value: FunnelStageConfig[K]) {
        setConfig((prev) => ({ ...prev, [key]: value }))
        setIsDirty(true)
    }

    function handleSave() {
        // Normaliza: remove template_name vazio para não salvar string vazia
        const normalized: FunnelStageConfig = {
            ...config,
            template_name: config.template_name?.trim() || undefined,
        }
        onSave(stage.id, normalized)
        setIsDirty(false)
    }

    // Resumo da config atual para o cabeçalho colapsado
    const hasConfig = !!(config.template_name?.trim() || (config.delay_hours ?? 0) > 0)

    return (
        <Card className="border border-zinc-700 bg-zinc-800/50">
            {/* Cabeçalho do card — clicável para expandir */}
            <CardHeader
                className="cursor-pointer select-none py-3 px-4"
                onClick={() => setIsExpanded((v) => !v)}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Bolinha de cor do estágio */}
                        <span
                            className="shrink-0 h-3 w-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                        />
                        <CardTitle className="text-sm font-medium text-zinc-100 truncate">
                            {stage.name}
                        </CardTitle>
                        {hasConfig && (
                            <span className="shrink-0 text-xs text-emerald-400 flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                Funil ativo
                            </span>
                        )}
                    </div>
                    <div className="shrink-0 text-zinc-500">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                </div>

                {/* Resumo colapsado */}
                {!isExpanded && hasConfig && (
                    <div className="mt-1 ml-6 flex flex-wrap gap-2 text-xs text-zinc-400">
                        {config.template_name?.trim() && (
                            <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {config.template_name.trim()}
                            </span>
                        )}
                        {(config.delay_hours ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {config.delay_hours}h
                            </span>
                        )}
                        {config.action_on_reply && config.action_on_reply !== 'none' && (
                            <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {ACTION_LABELS[config.action_on_reply]}
                            </span>
                        )}
                    </div>
                )}
            </CardHeader>

            {/* Conteúdo expandido */}
            {isExpanded && (
                <>
                    <Separator className="bg-zinc-700" />
                    <CardContent className="pt-4 pb-5 px-4 space-y-5">
                        {/* Template WhatsApp */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400 flex items-center gap-1.5">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Template WhatsApp
                            </Label>
                            <Input
                                placeholder="nome_do_template (ex: boas_vindas_lead)"
                                value={config.template_name ?? ''}
                                onChange={(e) => update('template_name', e.target.value)}
                                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm"
                            />
                            <p className="text-xs text-zinc-500">
                                Nome exato do template aprovado na Meta. Deixe vazio para não enviar mensagem neste estágio.
                            </p>
                        </div>

                        {/* Delay */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Delay antes do próximo disparo (horas)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                max={720}
                                step={1}
                                placeholder="24"
                                value={config.delay_hours ?? ''}
                                onChange={(e) =>
                                    update(
                                        'delay_hours',
                                        e.target.value === '' ? undefined : Number(e.target.value)
                                    )
                                }
                                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm w-32"
                            />
                            <p className="text-xs text-zinc-500">
                                0 = sem próximo disparo automático após este estágio.
                            </p>
                        </div>

                        {/* Ação ao responder */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400 flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5" />
                                Ação quando o lead responder
                            </Label>
                            <Select
                                value={config.action_on_reply ?? 'none'}
                                onValueChange={(v) =>
                                    update('action_on_reply', v as DealActionOnReply)
                                }
                            >
                                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                    {(Object.entries(ACTION_LABELS) as [DealActionOnReply, string][]).map(
                                        ([value, label]) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                                className="text-zinc-100 focus:bg-zinc-800"
                                            >
                                                {label}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-zinc-500">
                                Define o que acontece com o deal quando o contato mandar qualquer mensagem.
                            </p>
                        </div>

                        {/* Botão salvar */}
                        <div className="flex justify-end pt-1">
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving || !isDirty}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                            >
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                {isSaving ? 'Salvando…' : 'Salvar estágio'}
                            </Button>
                        </div>
                    </CardContent>
                </>
            )}
        </Card>
    )
}
