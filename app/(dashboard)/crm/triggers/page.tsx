'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, ArrowLeft, Zap, Trash2, LayoutList, Columns, GitBranch, RefreshCw, ToggleRight, ToggleLeft, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Page, PageHeader, PageTitle } from '@/components/ui/page'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FunnelSelector } from '@/components/features/crm/FunnelSelector'
import { TriggerBuilder, TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '@/components/features/crm/TriggerBuilder'
import { FunnelAutomationBoard } from '@/components/features/crm/FunnelAutomationBoard'
import { useTriggers, useTriggerLog } from '@/hooks/useTriggers'
import { useFunnels } from '@/hooks/useFunnels'
import { useCRM } from '@/hooks/useCRM'
import type { Trigger, TriggerType, TriggerConfig, TriggerActionType, TriggerActionConfig } from '@/types'

// =============================================================================
// Hook: conta triggers em todos os funis (para empty state)
// =============================================================================

function useAllTriggers() {
  return useQuery<Trigger[]>({
    queryKey: ['crm', 'triggers', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/crm/triggers')
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 30_000,
  })
}

// =============================================================================
// Empty state com funis alternativos
// =============================================================================

function FunnelEmptyState({
  funnels,
  allTriggers,
  activeFunnelId,
  onSelect,
}: {
  funnels: { id: string; name: string; isDefault?: boolean }[]
  allTriggers: Trigger[]
  activeFunnelId?: string
  onSelect: (id: string) => void
}) {
  const countByFunnel = allTriggers.reduce<Record<string, number>>((acc, t) => {
    const key = t.funnelId ?? '__none__'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const funnelsWithTriggers = funnels.filter(f => (countByFunnel[f.id] ?? 0) > 0)

  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 pb-20">
      <div>
        <Zap className="h-12 w-12 mx-auto mb-3 text-zinc-600 opacity-40" />
        <p className="text-sm font-medium text-zinc-300">
          Este funil não tem automações configuradas
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Selecione outro funil ou crie um trigger clicando em "Adicionar gatilho" em qualquer estágio.
        </p>
      </div>

      {funnelsWithTriggers.length > 0 && (
        <div className="w-full max-w-sm">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Funis com automações
          </p>
          <div className="space-y-1.5">
            {funnelsWithTriggers.map(f => (
              <button
                key={f.id}
                onClick={() => onSelect(f.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                  f.id === activeFunnelId
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-700 bg-zinc-800/60 hover:border-zinc-600 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-200">{f.name}</span>
                  {f.isDefault && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded">
                      padrão
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-emerald-400 shrink-0">
                  {countByFunnel[f.id]} trigger{countByFunnel[f.id] !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Painel lateral de edição — slide-over ao clicar no trigger
// =============================================================================

type ViewMode = 'board' | 'list'

const EMPTY_BUILDER = {
  name: '',
  triggerType: 'stage_enter' as TriggerType,
  triggerConfig: {} as TriggerConfig,
  stageId: undefined as string | undefined,
  actions: [] as { order: number; actionType: TriggerActionType; actionConfig: TriggerActionConfig }[],
}

// =============================================================================
// Página principal
// =============================================================================

export default function TriggersPage() {
  const searchParams = useSearchParams()
  const { funnels, defaultFunnel, isLoading: funnelsLoading } = useFunnels()
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(
    searchParams.get('funnel')
  )
  const activeFunnelId = selectedFunnelId ?? defaultFunnel?.id ?? undefined

  useEffect(() => {
    const p = searchParams.get('funnel')
    if (p && funnels.find(f => f.id === p)) setSelectedFunnelId(p)
  }, [funnels, searchParams])

  const {
    triggers, isLoading, refetch,
    createTrigger, updateTrigger, deleteTrigger, updateActions,
    toggleActive, isCreating, isSaving,
  } = useTriggers(activeFunnelId)

  const { stages } = useCRM(activeFunnelId)
  const { data: log = [] } = useTriggerLog()
  const { data: allTriggers = [] } = useAllTriggers()

  const [viewMode, setViewMode] = useState<ViewMode>('board')

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [editTrigger, setEditTrigger] = useState<Trigger | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Trigger | null>(null)
  const [builderValue, setBuilderValue] = useState(EMPTY_BUILDER)

  // Log drawer
  const [logOpen, setLogOpen] = useState(false)

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleOpenCreate = useCallback((stageId?: string) => {
    setBuilderValue({ ...EMPTY_BUILDER, stageId })
    setCreateOpen(true)
  }, [])

  const handleCreate = async () => {
    if (!builderValue.name.trim()) return
    try {
      await createTrigger({
        funnelId: activeFunnelId ?? null,
        stageId: builderValue.stageId ?? null,
        name: builderValue.name,
        triggerType: builderValue.triggerType,
        triggerConfig: builderValue.triggerConfig,
        actions: builderValue.actions.map(a => ({ order: a.order, actionType: a.actionType, actionConfig: a.actionConfig })),
      })
      toast.success('Trigger criado!')
      setCreateOpen(false)
      setBuilderValue(EMPTY_BUILDER)
    } catch (e: any) { toast.error(e.message) }
  }

  const handleOpenEdit = useCallback((trigger: Trigger) => {
    setEditTrigger(trigger)
    setBuilderValue({
      name: trigger.name,
      triggerType: trigger.triggerType,
      triggerConfig: trigger.triggerConfig,
      stageId: trigger.stageId ?? undefined,
      actions: (trigger.actions ?? []).map(a => ({ order: a.order, actionType: a.actionType, actionConfig: a.actionConfig })),
    })
  }, [])

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
    } catch (e: any) { toast.error(e.message) }
  }

  const stageName = (stageId?: string | null) => stages.find(s => s.id === stageId)?.name ?? '—'
  const boardIsEmpty = !isLoading && triggers.length === 0
  const activeTriggerCount = triggers.filter(t => t.isActive).length

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Page className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden pb-0">
      {/* -------------------------------------------------------------------- */}
      {/* Cabeçalho — mesmo estilo do CRM kanban                               */}
      {/* -------------------------------------------------------------------- */}
      <PageHeader className="shrink-0 pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-zinc-400">
              <Link href="/crm"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <PageTitle>Automações</PageTitle>
            <FunnelSelector
              funnels={funnels}
              selectedFunnelId={activeFunnelId ?? null}
              onSelect={setSelectedFunnelId}
              isLoading={funnelsLoading}
            />
          </div>
          {!isLoading && (
            <p className="text-xs text-zinc-500 pl-11">
              {triggers.length > 0
                ? `${triggers.length} trigger${triggers.length !== 1 ? 's' : ''} · ${activeTriggerCount} ativo${activeTriggerCount !== 1 ? 's' : ''}`
                : 'Nenhum trigger neste funil'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <Button
            variant="outline" size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-100 h-8 w-8 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Toggle board / list */}
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
            <button
              onClick={() => setViewMode('board')}
              title="Visão por etapa"
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Columns className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Visão em lista"
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => handleOpenCreate()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Trigger
          </Button>
        </div>
      </PageHeader>

      {/* -------------------------------------------------------------------- */}
      {/* Conteúdo — ocupas o restante da altura                               */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden min-h-0">

        {/* BOARD */}
        {viewMode === 'board' && (
          <div className="h-full overflow-x-auto overflow-y-hidden px-1 py-2">
            {boardIsEmpty ? (
              <FunnelEmptyState
                funnels={funnels}
                allTriggers={allTriggers}
                activeFunnelId={activeFunnelId}
                onSelect={setSelectedFunnelId}
              />
            ) : (
              <FunnelAutomationBoard
                stages={stages}
                triggers={triggers}
                onAdd={handleOpenCreate}
                onEdit={handleOpenEdit}
                onDelete={setDeleteTarget}
                onToggle={toggleActive}
                isLoading={isLoading}
              />
            )}
          </div>
        )}

        {/* LISTA */}
        {viewMode === 'list' && (
          <div className="h-full overflow-y-auto px-1 py-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-2">
                {isLoading ? (
                  [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-zinc-800/50 animate-pulse" />)
                ) : triggers.length === 0 ? (
                  <FunnelEmptyState
                    funnels={funnels}
                    allTriggers={allTriggers}
                    activeFunnelId={activeFunnelId}
                    onSelect={(id) => { setSelectedFunnelId(id); setViewMode('board') }}
                  />
                ) : (
                  triggers.map(trigger => (
                    <div
                      key={trigger.id}
                      onClick={() => handleOpenEdit(trigger)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        trigger.isActive
                          ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                          : 'bg-zinc-900/50 border-zinc-800/50 opacity-60'
                      }`}
                      style={{ borderLeft: `3px solid ${trigger.isActive ? '#10b981' : '#52525b'}` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span className="font-medium text-zinc-100">{trigger.name}</span>
                            {trigger.stageId && (
                              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                                📍 {stageName(trigger.stageId)}
                              </span>
                            )}
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
                          <button onClick={e => { e.stopPropagation(); toggleActive(trigger) }}
                            className="p-1.5 rounded text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors">
                            {trigger.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                          <button onClick={e => { e.stopPropagation(); setDeleteTarget(trigger) }}
                            className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Log lateral */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Execuções recentes</p>
                {log.length === 0 ? (
                  <p className="text-xs text-zinc-600">Nenhuma execução ainda.</p>
                ) : (
                  log.slice(0, 10).map(entry => (
                    <div key={entry.id} className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      {entry.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                      {entry.status === 'failed'  && <XCircle     className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />}
                      {(entry.status === 'running' || entry.status === 'skipped') && <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{entry.triggerName ?? '—'}</p>
                        {entry.errorMessage && <p className="text-[10px] text-red-400 truncate">{entry.errorMessage}</p>}
                        <p className="text-[10px] text-zinc-600">{entry.actionsExecuted} ação · {new Date(entry.startedAt).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Dialog — Criar trigger                                               */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              Novo Trigger
              {builderValue.stageId && (
                <span className="text-xs font-normal text-zinc-400">
                  → {stageName(builderValue.stageId)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {stages.length > 0 && (
            <div className="mb-3">
              <label className="text-xs text-zinc-400 mb-1 block">Etapa do funil</label>
              <Select
                value={builderValue.stageId ?? '__global__'}
                onValueChange={v => setBuilderValue(p => ({ ...p, stageId: v === '__global__' ? undefined : v }))}
              >
                <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="__global__" className="text-zinc-300 text-xs">
                    Qualquer etapa (global)
                  </SelectItem>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-zinc-300 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color ?? '#6366f1' }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

      {/* -------------------------------------------------------------------- */}
      {/* Dialog — Editar trigger (painel lateral)                             */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={!!editTrigger} onOpenChange={o => !o && setEditTrigger(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              Editar Trigger
              {editTrigger?.stageId && (
                <span className="text-xs font-normal text-zinc-400">
                  → {stageName(editTrigger.stageId)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {stages.length > 0 && (
            <div className="mb-3">
              <label className="text-xs text-zinc-400 mb-1 block">Etapa do funil</label>
              <Select
                value={builderValue.stageId ?? '__global__'}
                onValueChange={v => setBuilderValue(p => ({ ...p, stageId: v === '__global__' ? undefined : v }))}
              >
                <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="__global__" className="text-zinc-300 text-xs">
                    Qualquer etapa (global)
                  </SelectItem>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-zinc-300 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color ?? '#6366f1' }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <TriggerBuilder value={builderValue} onChange={setBuilderValue} stages={stages} />

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditTrigger(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!builderValue.name.trim() || isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSaving ? 'Salvando…' : 'Salvar Trigger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* AlertDialog — Remover trigger                                        */}
      {/* -------------------------------------------------------------------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover trigger?</AlertDialogTitle>
            <AlertDialogDescription>
              O trigger <strong>"{deleteTarget?.name}"</strong> e todas suas ações serão removidos permanentemente.
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

