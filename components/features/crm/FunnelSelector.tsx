'use client'

import { ChevronDown, Plus, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Funnel } from '@/types'

interface FunnelSelectorProps {
    funnels: Funnel[]
    selectedFunnelId: string | null
    onSelect: (funnelId: string) => void
    onManage?: () => void
    isLoading?: boolean
}

/**
 * FunnelSelector — dropdown para alternar entre funis no Kanban
 */
export function FunnelSelector({
    funnels,
    selectedFunnelId,
    onSelect,
    onManage,
    isLoading,
}: FunnelSelectorProps) {
    const selected = funnels.find((f) => f.id === selectedFunnelId) ?? funnels[0]

    if (isLoading) {
        return (
            <div className="h-8 w-40 rounded-lg bg-[var(--ds-bg-surface)] animate-pulse" />
        )
    }

    if (funnels.length === 0) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                        'bg-[var(--ds-bg-surface)] hover:bg-[var(--ds-bg-hover)]',
                        'text-[var(--ds-text-primary)] transition-colors',
                        'border border-[var(--ds-border-default)]'
                    )}
                >
                    <GitBranch className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="font-medium truncate max-w-[140px]">
                        {selected?.name ?? 'Selecionar funil'}
                    </span>
                    {selected?.isDefault && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded shrink-0">
                            padrão
                        </span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--ds-text-muted)] shrink-0" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                {funnels.map((funnel) => (
                    <DropdownMenuItem
                        key={funnel.id}
                        onClick={() => onSelect(funnel.id)}
                        className={cn(
                            'flex items-center justify-between gap-2 text-sm cursor-pointer',
                            funnel.id === selectedFunnelId && 'bg-emerald-500/10 text-emerald-400'
                        )}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <GitBranch className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{funnel.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {funnel.isDefault && (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded">
                                    padrão
                                </span>
                            )}
                            {funnel.openDealsCount !== undefined && (
                                <span className="text-[10px] text-[var(--ds-text-muted)]">
                                    {funnel.openDealsCount}
                                </span>
                            )}
                        </div>
                    </DropdownMenuItem>
                ))}

                {onManage && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onManage}
                            className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)] cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Gerenciar funis
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
