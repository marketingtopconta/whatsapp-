'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, ArrowLeft, Zap, ToggleLeft, ToggleRight, Trash2, Pencil, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Page, PageHeader, PageTitle, PageDescription } from '@/components/ui/page'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { FunnelSelector } from '@/components/features/crm/FunnelSelector'
import { TriggerBuilder, TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '@/components/features/crm/TriggerBuilder'
import { useTriggers, useTriggerLog } from '@/hooks/useTriggers'
import { useFunnels } from '@/hooks/useFunnels'
import { useCRM } from '@/hooks/useCRM'
import type { Trigger, TriggerType, TriggerConfig, TriggerActionType, TriggerActionConfig } from '@/types'

const EMPTY_BUILDER = {
    name: '',
    triggerType: 'time_no_reply' as TriggerType,
    triggerConfig: {} as TriggerConfig,
    actions: [] as { order: number; actionType: TriggerActionType; actionConfig: TriggerActionConfig }[],
}

export default function TriggersPage() {
    const { funnels, defaultFunnel, isLoading: funnelsLoading } = useFunnels()
    const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null)
    const activeFunnelId = selectedFunnelId ?? defaultFunnel?.id ?? undefined

    const { triggers, isLoading, createTrigger, updateTrigger, deleteTrigger, updateActions, toggleActive, isCreating, isSaving } = useTriggers(activeFunnelId)
    const { stages } = useCRM(activeFunnelId)
    const { data: log = [] } = useTriggerLog()

    const [createOpen, setCreateOpen] = useState(false)
    const [editTrigger, setEditTrigger] = useState<Trigger | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Trigger | null>(null)
    const [builderValue, setBuilderValue] = useState(EMPTY_BUILDER)

    const handleCreate = async () => {
        if (!builderValue.name.trim()) return
        try {
            await createTrigger({
                funnelId: activeFunnelId ?? null,
                name: builderValue.name,
                triggerType: builderValue.triggerType,
                triggerConfig: builderValue.triggerConfig,
                actions: builderValue.actions.map((a) => ({
                    order: a.order,
                    actionType: a.actionType,
                    actionConfig: a.actionConfig,
                })),
            })
            toast.success('Trigger criado!')
            setCreateOpen(false)
            setBuilderValue(EMPTY_BUILDER)
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleSaveEdit = async () => {
        if (!editTrigger || !builderValue.name.trim()) return
        try {
            await updateTrigger(editTrigger.id, {
                name: builderValue.name,
                triggerType: builderValue.triggerType,
                triggerConfig: builderValue.triggerConfig,
            })
            await updateActions(editTrigger.id, builderValue.actions)
            toast.success('Trigger atualizado!')
            setEditTrigger(null)
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const openEdit = (trigger: Trigger) => {
        setEditTrigger(trigger)
        setBuilderValue({
            name: trigger.name,
            triggerType: trigger.triggerType,
            triggerConfig: trigger.triggerConfig,
            actions: (trigger.actions ?? []).map((a) => ({
                order: a.order,
                actionType: a.actionType,
                actionConfig: a.actionConfig,
            })),
        })
    }

    const recentLog = log.slice(0, 10)

    return (
        <Page>
            <PageHeader>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <Link href="/crm"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <PageTitle>Automações</PageTitle>
                            <FunnelSelector
                                funnels={funnels}
                                selectedFunnelId={activeFunnelId ?? null}
                                onSelect={setSelectedFunnelId}
                                isLoading={funnelsLoading}
                            />
                        </div>
                        <PageDescription>
                            Configure triggers que disparam sequências de ações automaticamente.
                        </PageDescription>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => { setBuilderValue(EMPTY_BUILDER); setCreateOpen(true) }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Novo Trigger
                </Button>
            </PageHeader>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lista de triggers */}
                <div className="lg:col-span-2 space-y-3">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2].map((i) => (
                                <div key={i} className="h-20 rounded-xl bg-zinc-800/50 animate-pulse" />
                            ))}
                        </div>
                    ) : triggers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                            <Zap className="h-8 w-8 mb-2 opacity-40" />
                            <p className="text-sm">Nenhum trigger configurado.</p>
                            <Button variant="link" className="text-emerald-400 mt-1 text-xs"
                                onClick={() => { setBuilderValue(EMPTY_BUILDER); setCreateOpen(true) }}>
                                Criar primeiro trigger
                            </Button>
                        </div>
                    ) : (
                        triggers.map((trigger) => (
                            <div key={trigger.id} className={`p-4 rounded-xl border transition-colors ${trigger.isActive ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-900/50 border-zinc-800/50 opacity-60'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                            <span className="font-medium text-zinc-100 truncate">{trigger.name}</span>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {TRIGGER_TYPE_LABELS[trigger.triggerType]}
                                        </p>
                                        {(trigger.actions ?? []).length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {(trigger.actions ?? []).map((a, i) => (
                                                    <span key={i} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                                                        {ACTION_TYPE_LABELS[a.actionType]}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => toggleActive(trigger)} title={trigger.isActive ? 'Desativar' : 'Ativar'}
                                            className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors">
                                            {trigger.isActive
                                                ? <ToggleRight className="h-4 w-4 text-emerald-400" />
                                                : <ToggleLeft className="h-4 w-4" />
                                            }
                                        </button>
                                        <button onClick={() => openEdit(trigger)}
                                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => setDeleteTarget(trigger)}
                                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Log de execuções recentes */}
                <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Execuções recentes</p>
                    {recentLog.length === 0 ? (
                        <p className="text-xs text-zinc-600">Nenhuma execução ainda.</p>
                    ) : (
                        recentLog.map((entry) => (
                            <div key={entry.id} className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                                {entry.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                                {entry.status === 'failed'  && <XCircle     className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />}
                                {entry.status === 'running' && <Clock       className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />}
                                {entry.status === 'skipped' && <Clock       className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />}
                                <div className="min-w-0">
                                    <p className="text-xs text-zinc-300 truncate">{entry.triggerName ?? '—'}</p>
                                    {entry.errorMessage && (
                                        <p className="text-[10px] text-red-400 truncate">{entry.errorMessage}</p>
                                    )}
                                    <p className="text-[10px] text-zinc-600">
                                        {entry.actionsExecuted} ação(ões) · {new Date(entry.startedAt).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Dialog — Criar trigger */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Novo Trigger</DialogTitle>
                    </DialogHeader>
                    <TriggerBuilder value={builderValue} onChange={setBuilderValue} stages={stages} />
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={!builderValue.name.trim() || isCreating}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isCreating ? 'Criando…' : 'Criar Trigger'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog — Editar trigger */}
            <Dialog open={!!editTrigger} onOpenChange={(o) => !o && setEditTrigger(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar Trigger</DialogTitle>
                    </DialogHeader>
                    <TriggerBuilder value={builderValue} onChange={setBuilderValue} stages={stages} />
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setEditTrigger(null)}>Cancelar</Button>
                        <Button onClick={handleSaveEdit} disabled={!builderValue.name.trim() || isSaving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isSaving ? 'Salvando…' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AlertDialog — Remover trigger */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover trigger?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O trigger <strong>"{deleteTarget?.name}"</strong> será removido permanentemente junto com suas ações.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                try {
                                    await deleteTrigger(deleteTarget!.id)
                                    toast.success('Trigger removido')
                                    setDeleteTarget(null)
                                } catch (e: any) { toast.error(e.message) }
                            }}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Page>
    )
}
