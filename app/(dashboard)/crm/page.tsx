'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, Settings2, Plus, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Page, PageHeader, PageTitle, PageDescription } from '@/components/ui/page'
import { KanbanBoard } from '@/components/features/crm/KanbanBoard'
import { DealDetailPanel } from '@/components/features/crm/DealDetailPanel'
import { CreateDealDialog } from '@/components/features/crm/CreateDealDialog'
import { useCRM } from '@/hooks/useCRM'
import type { Deal } from '@/types'

// ---------------------------------------------------------------------------
// Métricas compactas
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
// Página principal — Kanban CRM
// ---------------------------------------------------------------------------

export default function CRMKanbanPage() {
    const {
        stages,
        allDeals,
        dealsByStage,
        isLoading,
        createDeal,
        moveDeal,
        updateDeal,
        markWon,
        markLost,
        deleteDeal,
        isCreating,
        refetch,
    } = useCRM()

    // Painel lateral de detalhes
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)

    // Dialog de criação
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [defaultStageId, setDefaultStageId] = useState<string | undefined>(undefined)

    const handleDealClick = useCallback((deal: Deal) => {
        setSelectedDeal(deal)
    }, [])

    const handleAddDeal = useCallback((stageId: string) => {
        setDefaultStageId(stageId)
        setCreateDialogOpen(true)
    }, [])

    const handleMoveDeal = useCallback(
        (dealId: string, stageId: string) => {
            moveDeal(dealId, stageId)
            // Atualiza o deal selecionado no painel se for o mesmo
            setSelectedDeal((prev) =>
                prev?.id === dealId ? { ...prev, stageId } : prev
            )
        },
        [moveDeal]
    )

    return (
        <Page className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden pb-0">
            {/* Cabeçalho */}
            <PageHeader className="shrink-0 pb-3">
                <div>
                    <PageTitle>Funil CRM</PageTitle>
                    <PageDescription className="sr-only">
                        Board drag-and-drop com atualização em tempo real
                    </PageDescription>
                    {!isLoading && <MetricsBar allDeals={allDeals} />}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refetch}
                        disabled={isLoading}
                        className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
                    >
                        <Link href="/crm/config">
                            <Settings2 className="h-4 w-4 mr-1.5" />
                            Configurar Funil
                        </Link>
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            setDefaultStageId(stages[0]?.id)
                            setCreateDialogOpen(true)
                        }}
                        disabled={stages.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Novo Deal
                    </Button>
                </div>
            </PageHeader>

            {/* Board + painel lateral */}
            <div className="flex flex-1 gap-0 overflow-hidden min-h-0">
                {/* Kanban Board */}
                <div
                    className={`flex-1 overflow-hidden transition-all duration-300 ${
                        selectedDeal ? 'pr-0' : ''
                    }`}
                >
                    {isLoading ? (
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

                {/* Painel lateral de detalhes */}
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
            </div>

            {/* Dialog de criação */}
            <CreateDealDialog
                open={createDialogOpen}
                stages={stages}
                defaultStageId={defaultStageId}
                onOpenChange={setCreateDialogOpen}
                onCreate={createDeal}
                isCreating={isCreating}
            />
        </Page>
    )
}
