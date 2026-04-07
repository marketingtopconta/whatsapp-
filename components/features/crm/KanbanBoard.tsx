'use client'

import { useState, useCallback } from 'react'
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { DealCard } from './DealCard'
import type { Deal, PipelineStage } from '@/types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface KanbanBoardProps {
    stages: PipelineStage[]
    dealsByStage: Map<string, Deal[]>
    onMoveDeal: (dealId: string, stageId: string) => void
    onDealClick: (deal: Deal) => void
    onAddDeal: (stageId: string) => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function KanbanBoard({
    stages,
    dealsByStage,
    onMoveDeal,
    onDealClick,
    onAddDeal,
}: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [activeDeal, setActiveDeal] = useState<Deal | null>(null)

    // Sensor configurado para mouse e touch
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                // Exige 8px de movimento antes de iniciar drag (evita click acidental)
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 8,
            },
        })
    )

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event
        setActiveId(String(active.id))
        setActiveDeal((active.data.current as any)?.deal ?? null)
    }, [])

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event
            setActiveId(null)
            setActiveDeal(null)

            if (!over) return

            const dealId = String(active.id)
            // O droppable pode ser a coluna (stageId) ou um card (deal.stageId)
            const overData = over.data.current as any
            const targetStageId: string = overData?.stageId ?? String(over.id)

            const deal = (active.data.current as any)?.deal as Deal | undefined
            if (!deal) return

            if (deal.stageId === targetStageId) return // Sem mudança

            onMoveDeal(dealId, targetStageId)
        },
        [onMoveDeal]
    )

    const handleDragOver = useCallback((_event: DragOverEvent) => {
        // Apenas para atualizar estilos — o drop real acontece no DragEnd
    }, [])

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
        >
            {/* Board: scroll horizontal */}
            <div className="flex gap-4 pb-6 overflow-x-auto h-full min-h-[500px]">
                {stages.map((stage) => (
                    <KanbanColumn
                        key={stage.id}
                        stage={stage}
                        deals={dealsByStage.get(stage.id) ?? []}
                        onDealClick={onDealClick}
                        onAddDeal={onAddDeal}
                        activeId={activeId}
                    />
                ))}

                {stages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                        Nenhum estágio configurado. Vá em{' '}
                        <a href="/crm/config" className="ml-1 text-emerald-400 underline">
                            Configurações do Funil
                        </a>
                        .
                    </div>
                )}
            </div>

            {/* Overlay: mostra o card sendo arrastado */}
            <DragOverlay dropAnimation={null}>
                {activeDeal ? (
                    <DealCard
                        deal={activeDeal}
                        onClick={() => {}}
                        isDragOverlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
