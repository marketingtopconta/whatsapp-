'use client'

import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Clock, User, DollarSign, Trophy, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Deal } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: number): string {
    if (value === 0) return ''
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`
    return `R$ ${value.toLocaleString('pt-BR')}`
}

function formatCountdown(nextActionAt: string | null): {
    label: string
    overdue: boolean
} | null {
    if (!nextActionAt) return null
    const diff = new Date(nextActionAt).getTime() - Date.now()
    const overdue = diff < 0
    const abs = Math.abs(diff)

    const hours = Math.floor(abs / 3_600_000)
    const minutes = Math.floor((abs % 3_600_000) / 60_000)

    if (abs < 3_600_000) {
        return { label: overdue ? `Atrasado ${minutes}min` : `${minutes}min`, overdue }
    }
    if (hours < 48) {
        return { label: overdue ? `Atrasado ${hours}h` : `${hours}h restantes`, overdue }
    }
    const days = Math.floor(hours / 24)
    return { label: overdue ? `Atrasado ${days}d` : `${days}d restantes`, overdue }
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface DealCardProps {
    deal: Deal
    onClick: (deal: Deal) => void
    isDragOverlay?: boolean
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function DealCard({ deal, onClick, isDragOverlay }: DealCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: deal.id,
        data: { deal, type: 'deal' },
    })

    const style = {
        transform: CSS.Translate.toString(transform),
    }

    const countdown = useMemo(() => formatCountdown(deal.nextActionAt), [deal.nextActionAt])
    const valueLabel = useMemo(() => formatValue(deal.value), [deal.value])

    const isWon = deal.status === 'won'
    const isLost = deal.status === 'lost'

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                // Permite click para abrir detalhe
                if (!isDragging) onClick(deal)
            }}
            className={cn(
                'group relative bg-zinc-800 border border-zinc-700 rounded-lg p-3 cursor-grab active:cursor-grabbing',
                'hover:border-zinc-600 hover:bg-zinc-750 transition-colors',
                'select-none touch-none',
                isDragging && 'opacity-40',
                isDragOverlay && 'shadow-xl border-zinc-500 opacity-100 rotate-1 cursor-grabbing',
                isWon && 'border-l-2 border-l-emerald-500',
                isLost && 'border-l-2 border-l-red-500 opacity-60'
            )}
        >
            {/* Status badge para won/lost */}
            {(isWon || isLost) && (
                <div
                    className={cn(
                        'absolute top-2 right-2 flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
                        isWon
                            ? 'bg-emerald-900/60 text-emerald-400'
                            : 'bg-red-900/60 text-red-400'
                    )}
                >
                    {isWon ? <Trophy className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {isWon ? 'Ganho' : 'Perdido'}
                </div>
            )}

            {/* Título */}
            <p className="text-sm font-medium text-zinc-100 leading-snug pr-12 mb-2 line-clamp-2">
                {deal.title}
            </p>

            {/* Contato */}
            {deal.contact && (
                <div className="flex items-center gap-1 text-xs text-zinc-400 mb-1.5">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{deal.contact.name}</span>
                </div>
            )}

            {/* Valor + Timer */}
            <div className="flex items-center justify-between gap-2 mt-2">
                {valueLabel ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <DollarSign className="h-3 w-3" />
                        {valueLabel}
                    </span>
                ) : (
                    <span />
                )}

                {countdown && (
                    <span
                        className={cn(
                            'flex items-center gap-1 text-xs shrink-0',
                            countdown.overdue ? 'text-red-400' : 'text-zinc-400'
                        )}
                    >
                        <Clock className="h-3 w-3" />
                        {countdown.label}
                    </span>
                )}
            </div>
        </div>
    )
}
