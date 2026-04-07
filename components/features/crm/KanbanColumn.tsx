'use client'

import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DealCard } from './DealCard'
import type { Deal, PipelineStage } from '@/types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface KanbanColumnProps {
    stage: PipelineStage
    deals: Deal[]
    onDealClick: (deal: Deal) => void
    onAddDeal: (stageId: string) => void
    activeId: string | null
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function KanbanColumn({
    stage,
    deals,
    onDealClick,
    onAddDeal,
    activeId,
}: KanbanColumnProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: stage.id,
        data: { stageId: stage.id },
    })

    const openDeals = deals.filter((d) => d.status === 'open')
    const closedDeals = deals.filter((d) => d.status !== 'open')
    const sortedDeals = [...openDeals, ...closedDeals]

    const totalValue = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)

    return (
        <div className="flex flex-col h-full min-w-[260px] max-w-[280px] shrink-0">
            {/* Cabeçalho da coluna */}
            <div className="flex items-center gap-2 mb-3 px-1">
                <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color }}
                />
                <span className="text-sm font-medium text-zinc-200 truncate flex-1">
                    {stage.name}
                </span>
                <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">
                    {openDeals.length}
                </span>
            </div>

            {/* Valor total */}
            {totalValue > 0 && (
                <div className="text-xs text-zinc-500 mb-2 px-1">
                    Total: R$ {totalValue.toLocaleString('pt-BR')}
                </div>
            )}

            {/* Área de drop */}
            <div
                ref={setNodeRef}
                className={cn(
                    'flex-1 flex flex-col gap-2 rounded-xl p-2 min-h-[120px] transition-colors',
                    isOver
                        ? 'bg-zinc-700/60 ring-1 ring-zinc-500'
                        : 'bg-zinc-900/40'
                )}
            >
                {sortedDeals.map((deal) => (
                    <DealCard
                        key={deal.id}
                        deal={deal}
                        onClick={onDealClick}
                        isDragOverlay={deal.id === activeId}
                    />
                ))}

                {/* Placeholder quando empty */}
                {sortedDeals.length === 0 && !isOver && (
                    <div className="flex-1 flex items-center justify-center text-xs text-zinc-600 border border-dashed border-zinc-700 rounded-lg py-6">
                        Solte deals aqui
                    </div>
                )}
            </div>

            {/* Botão adicionar deal */}
            <button
                onClick={() => onAddDeal(stage.id)}
                className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors w-full"
            >
                <Plus className="h-3.5 w-3.5" />
                Adicionar deal
            </button>
        </div>
    )
}
