'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, Settings2, Plus, BarChart2, Zap, Users2, LayoutList, Columns } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Page, PageHeader, PageTitle, PageDescription } from '@/components/ui/page'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { KanbanBoard } from '@/components/features/crm/KanbanBoard'
import { DealDetailPanel } from '@/components/features/crm/DealDetailPanel'
import { CreateDealDialog } from '@/components/features/crm/CreateDealDialog'
import { FunnelSelector } from '@/components/features/crm/FunnelSelector'
import { FunnelAutomationBoard } from '@/components/features/crm/FunnelAutomationBoard'
import { TriggerBuilder } from '@/components/features/crm/TriggerBuilder'
import { useCRM } from '@/hooks/useCRM'
import { useFunnels } from '@/hooks/useFunnels'
import { useTriggers } from '@/hooks/useTriggers'
import type { Deal, Trigger, TriggerType, TriggerConfig, TriggerActionType, TriggerActionConfig } from '@/types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type ViewMode = 'leads' | 'automations'

const EMPTY_BUILDER = {
    name: '',
    triggerType: 'stage_enter' as TriggerType,
    triggerConfig: {} as TriggerConfig,
    stageId: undefined as string | undefined,
    actions: [] as { order: number; actionType: TriggerActionType; actionConfig: TriggerActionConfig }[],
}

// ---------------------------------------------------------------------------
// Métricas compactas (modo leads)
// ---------------------------------------------------------------------------

function MetricsBar({ allDeals }: { allDeals: Deal[] }) {
    const open = allDeals.filter((d) => d.status === 'open')
    const won = allDeals.filter((d) => d.status === 'won')
    const lost = allDeals.filter((d) => d.status === 'lost')
    const totalOpen = open.reduce((s, d) => s + (d.value ?? 0), 0)
    const total = won.length + lost.length
    const rate = total > 0 ? Math.round((won.length / total) * 100) : 0

    return (
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>
                <span className="font-semibold text-zinc-200">{open.length}</span> abertos
            </span>
            {totalOpen > 0 && (
                <span>
                    R${' '}
                    <span className="font-semibold text-emerald-400">
                        {totalOpen.toLocaleString('pt-BR')}
                    </span>{' '}
                    em aberto
                </span>
            )}
            <span>
                <span className="font-semibold text-emerald-400">{won.length}</span> ganhos
            </span>
            <span>
                <span className="font-semibold text-red-400">{lost.length}</span> perdidos
            </span>
            {total > 0 && (
                <span>
                    Conversão:{' '}
                    <span className="font-semibold text-zinc-200">{rate}%</span>
                </span>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Métricas compactas (modo automações)
// ---------------------------------------------------------------------------

function AutomationsBar({ triggers }: { triggers: Trigger[] }) {
    const active = triggers.filter((t) => t.isActive).length
    return (
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>
                <span className="font-semibold text-zinc-200">{triggers.length}</span>{' '}
                trigger{triggers.length !== 1 ? 's' : ''}
            </span>
            <span>
                <span className="font-semibold text-emerald-400">{active}</span> ativo{active !== 1 ? 's' : ''}
            </span>
            {triggers.length - active > 0 && (
                <span>
                    <span className="font-semibold text-zinc-500">{triggers.length - active}</span> inativo{(triggers.length - active) !== 1 ? 's' : ''}
                </span>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function CRMKanbanPage() {
    const router = useRouter()

    // Funis disponíveis
    const { funnels, defaultFunnel, isLoading: funnelsLoading } = useFunnels()

    // Funil selecionado
    const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null)
    const activeFunnelId = selectedFunnelId ?? defaultFunnel?.id ?? null

    // Modo de visualização
    const [viewMode, setViewMode] = useState<ViewMode>('leads')

    // -------------------------------------------------------------------------
    // CRM — leads
    // -------------------------------------------------------------------------
    const {
        stages,
        allDeals,
        dealsByStage,
        isLoading: dealsLoading,
        createDeal,
        moveDeal,
        updateDeal,
        markWon,
        markLost,
        deleteDeal,
        isCreating: isDealCreating,
        refetch: refetchDeals,
    } = useCRM(activeFunnelId ?? undefined)

    // Painel lateral de detalhes
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)

    // Dialog de criação de deal
    const [createDealOpen, setCreateDealOpen] = useState(false)
    const [defaultStageId, setDefaultStageId] = useState<string | undefined>(undefined)

    const handleDealClick = useCallback((deal: Deal) => setSelectedDeal(deal), [])

    const handleAddDeal = useCallback((stageId: string) => {
        setDefaultStageId(stageId)
        setCreateDealOpen(true)
    }, [])

    const handleMoveDeal = useCallback(
        (dealId: string, stageId: string) => {
            moveDeal(dealId, stageId)
            setSelectedDeal((prev) =>
                prev?.id === dealId ? { ...prev, stageId } : prev
            )
        },
        [moveDeal]
    )

    // -------------------------------------------------------------------------
    // Triggers — automações
    // -------------------------------------------------------------------------
    const {
        triggers,
        isLoading: triggersLoading,
        refetch: refetchTriggers,
        createTrigger,
        updateTrigger,
        deleteTrigger,
        updateActions,
        toggleActive,
        isCreating: isTriggerCreating,
        isSaving: isTriggerSaving,
    } = useTriggers(activeFunnelId ?? undefined)

    // Dialogs de trigger
    const [createTriggerOpen, setCreateTriggerOpen] = useState(false)
    const [editTrigger, setEditTrigger] = useState<Trigger | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Trigger | null>(null)
    const [builderValue, setBuilderValue] = useState(EMPTY_BUILDER)

    const stageName = (stageId?: string | null) =>
        stages.find((s) => s.id === stageId)?.name ?? '—'

    const handleOpenCreate = useCallback((stageId?: string) => {
        setBuilderValue({ ...EMPTY_BUILDER, stageId })
        setCreateTriggerOpen(true)
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
                actions: builderValue.actions,
            })
            toast.success('Trigger criado!')
            setCreateTriggerOpen(false)
            setBuilderValue(EMPTY_BUILDER)
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleOpenEdit = useCallback((trigger: Trigger) => {
        setEditTrigger(trigger)
        setBuilderValue({
            name: trigger.name,
            triggerType: trigger.triggerType,
            triggerConfig: trigger.triggerConfig,
            stageId: trigger.stageId ?? undefined,
            actions: (trigger.actions ?? []).map((a) => ({
                order: a.order,
                actionType: a.actionType,
                actionConfig: a.actionConfig,
            })),
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
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const isLoading = viewMode === 'leads' ? dealsLoading : triggersLoading

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    return (
        <Page className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden pb-0">
            {/* Cabeçalho */}
            <PageHeader className="shrink-0 pb-3">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                        <PageTitle>Funil CRM</PageTitle>
                        <FunnelSelector
                            funnels={funnels}
                            selectedFunnelId={activeFunnelId}
                            onSelect={setSelectedFunnelId}
                            onManage={() => router.push('/crm/funnels')}
                            isLoading={funnelsLoading}
                        />

                        {/* Toggle de modo — Leads / Automações */}
                        <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 ml-1">
                            <button
                                onClick={() => setViewMode('leads')}
                                title="Ver leads"
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                    viewMode === 'leads'
                                        ? 'bg-zinc-700 text-zinc-100'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <Users2 className="h-3.5 w-3.5" />
                                Leads
                            </button>
                            <button
                                onClick={() => setViewMode('automations')}
                                title="Ver automações"
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                    viewMode === 'automations'
                                        ? 'bg-amber-600/30 text-amber-300'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <Zap className="h-3.5 w-3.5" />
                                Automações
                            </button>
                        </div>
                    </div>

                    {/* Sub-linha de métricas */}
                    {!isLoading && viewMode === 'leads' && (
                        <MetricsBar allDeals={allDeals} />
                    )}
                    {!isLoading && viewMode === 'automations' && (
                        <AutomationsBar triggers={triggers} />
                    )}
                </div>

                {/* Botões de ação — variam por modo */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewMode === 'leads' ? refetchDeals() : refetchTriggers()}
                        disabled={isLoading}
                        className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>

                    {viewMode === 'leads' && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
                            >
                                <Link href="/crm/analytics">
                                    <BarChart2 className="h-4 w-4 mr-1.5" />
                                    Analytics
                                </Link>
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setDefaultStageId(stages[0]?.id)
                                    setCreateDealOpen(true)
                                }}
                                disabled={stages.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <Plus className="h-4 w-4 mr-1.5" />
                                Novo Deal
                            </Button>
                        </>
                    )}

                    {viewMode === 'automations' && (
                        <Button
                            size="sm"
                            onClick={() => handleOpenCreate()}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            <Plus className="h-4 w-4 mr-1.5" />
                            Novo Trigger
                        </Button>
                    )}
                </div>
            </PageHeader>

            {/* ---------------------------------------------------------------- */}
            {/* Board area                                                        */}
            {/* ---------------------------------------------------------------- */}
            <div className="flex flex-1 gap-0 overflow-hidden min-h-0">

                {/* MODO LEADS */}
                {viewMode === 'leads' && (
                    <>
                        <div className={`flex-1 overflow-hidden transition-all duration-300`}>
                            {dealsLoading ? (
                                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                                    Carregando funil…
                                </div>
                            ) : (
                                <div className="h-full overflow-x-auto overflow-y-hidden px-1 py-2">
                                    <KanbanBoard
                                        stages={stages}
                                        dealsByStage={dealsByStage}
                                        onMoveDeal={handleMoveDeal}
                                        onDealClick={handleDealClick}
                                        onAddDeal={handleAddDeal}
                                    />
                                </div>
                            )}
                        </div>

                        {selectedDeal && (
                            <div className="w-80 shrink-0 border-l border-zinc-800 overflow-hidden">
                                <DealDetailPanel
                                    deal={selectedDeal}
                                    onClose={() => setSelectedDeal(null)}
                                    onUpdate={(id, dto) => {
                                        updateDeal(id, dto)
                                        setSelectedDeal((prev) =>
                                            prev?.id === id ? { ...prev, ...dto } : prev
                                        )
                                    }}
                                    onMarkWon={(id) => {
                                        markWon(id)
                                        setSelectedDeal((prev) =>
                                            prev?.id === id
                                                ? { ...prev, status: 'won', wonAt: new Date().toISOString() }
                                                : prev
                                        )
                                    }}
                                    onMarkLost={(id) => {
                                        markLost(id)
                                        setSelectedDeal((prev) =>
                                            prev?.id === id
                                                ? { ...prev, status: 'lost', lostAt: new Date().toISOString() }
                                                : prev
                                        )
                                    }}
                                    onDelete={(id) => {
                                        deleteDeal(id)
                                        setSelectedDeal(null)
                                    }}
                                />
                            </div>
                        )}
                    </>
                )}

                {/* MODO AUTOMAÇÕES */}
                {viewMode === 'automations' && (
                    <div className="flex-1 overflow-x-auto overflow-y-hidden px-1 py-2">
                        <FunnelAutomationBoard
                            stages={stages}
                            triggers={triggers}
                            onAdd={handleOpenCreate}
                            onEdit={handleOpenEdit}
                            onDelete={setDeleteTarget}
                            onToggle={toggleActive}
                            isLoading={triggersLoading}
                        />
                    </div>
                )}
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* Dialogs — Deal                                                    */}
            {/* ---------------------------------------------------------------- */}
            <CreateDealDialog
                open={createDealOpen}
                stages={stages}
                defaultStageId={defaultStageId}
                onOpenChange={setCreateDealOpen}
                onCreate={createDeal}
                isCreating={isDealCreating}
            />

            {/* ---------------------------------------------------------------- */}
            {/* Dialog — Criar trigger                                            */}
            {/* ---------------------------------------------------------------- */}
            <Dialog open={createTriggerOpen} onOpenChange={setCreateTriggerOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-400" />
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
                                onValueChange={(v) =>
                                    setBuilderValue((p) => ({
                                        ...p,
                                        stageId: v === '__global__' ? undefined : v,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                    <SelectItem value="__global__" className="text-zinc-300 text-xs">
                                        Qualquer etapa (global)
                                    </SelectItem>
                                    {stages.map((s) => (
                                        <SelectItem key={s.id} value={s.id} className="text-zinc-300 text-xs">
                                            <span className="flex items-center gap-1.5">
                                                <span
                                                    className="inline-block w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: s.color ?? '#6366f1' }}
                                                />
                                                {s.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <TriggerBuilder
                        value={builderValue}
                        onChange={(v) => setBuilderValue((prev) => ({ ...prev, ...v }))}
                        stages={stages}
                    />

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setCreateTriggerOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!builderValue.name.trim() || isTriggerCreating}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isTriggerCreating ? 'Criando…' : 'Criar Trigger'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ---------------------------------------------------------------- */}
            {/* Dialog — Editar trigger                                           */}
            {/* ---------------------------------------------------------------- */}
            <Dialog open={!!editTrigger} onOpenChange={(o) => !o && setEditTrigger(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-400" />
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
                                onValueChange={(v) =>
                                    setBuilderValue((p) => ({
                                        ...p,
                                        stageId: v === '__global__' ? undefined : v,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                    <SelectItem value="__global__" className="text-zinc-300 text-xs">
                                        Qualquer etapa (global)
                                    </SelectItem>
                                    {stages.map((s) => (
                                        <SelectItem key={s.id} value={s.id} className="text-zinc-300 text-xs">
                                            <span className="flex items-center gap-1.5">
                                                <span
                                                    className="inline-block w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: s.color ?? '#6366f1' }}
                                                />
                                                {s.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <TriggerBuilder
                        value={builderValue}
                        onChange={(v) => setBuilderValue((prev) => ({ ...prev, ...v }))}
                        stages={stages}
                    />

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setEditTrigger(null)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSaveEdit}
                            disabled={!builderValue.name.trim() || isTriggerSaving}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isTriggerSaving ? 'Salvando…' : 'Salvar Trigger'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ---------------------------------------------------------------- */}
            {/* AlertDialog — Remover trigger                                     */}
            {/* ---------------------------------------------------------------- */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover trigger?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O trigger <strong>"{deleteTarget?.name}"</strong> e todas suas ações serão
                            removidos permanentemente.
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
                                } catch (e: any) {
                                    toast.error(e.message)
                                }
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
