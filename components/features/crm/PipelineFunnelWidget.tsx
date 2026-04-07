'use client'

import Link from 'next/link'
import { ArrowUpRight, TrendingUp } from 'lucide-react'
import { usePipelineMetrics } from '@/hooks/usePipelineMetrics'

/**
 * PipelineFunnelWidget
 *
 * Widget de funil de conversão para o dashboard principal.
 * Exibe métricas por estágio em forma de funil visual decrescente,
 * mais totais consolidados (abertos, ganhos, taxa de conversão).
 */
export function PipelineFunnelWidget() {
    const { data, isLoading } = usePipelineMetrics()

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3 animate-pulse">
                {[80, 65, 50, 35].map((w, i) => (
                    <div
                        key={i}
                        className="h-8 rounded-md bg-[var(--ds-bg-surface)]"
                        style={{ width: `${w}%` }}
                    />
                ))}
            </div>
        )
    }

    if (!data || data.stages.length === 0) {
        return (
            <p className="text-xs text-[var(--ds-text-muted)] text-center py-4">
                Nenhum dado de funil disponível.
            </p>
        )
    }

    const { stages, totals } = data

    // Valor máximo de deals abertos para calcular a largura relativa das barras
    const maxOpen = Math.max(...stages.map((s) => s.open_count), 1)

    return (
        <div className="flex flex-col gap-4">
            {/* Funil visual */}
            <div className="flex flex-col gap-1.5">
                {stages.map((stage) => {
                    const pct = Math.max(Math.round((stage.open_count / maxOpen) * 100), 8)
                    return (
                        <div key={stage.stage_id} className="flex items-center gap-2 group">
                            {/* Barra */}
                            <div className="flex-1 h-7 bg-[var(--ds-bg-surface)] rounded-md overflow-hidden">
                                <div
                                    className="h-full rounded-md flex items-center px-2.5 transition-all duration-500"
                                    style={{
                                        width: `${pct}%`,
                                        backgroundColor: stage.stage_color + '33',
                                        borderLeft: `3px solid ${stage.stage_color}`,
                                    }}
                                >
                                    <span className="text-[11px] font-medium truncate" style={{ color: stage.stage_color }}>
                                        {stage.stage_name}
                                    </span>
                                </div>
                            </div>
                            {/* Contagem */}
                            <span className="text-[11px] text-[var(--ds-text-muted)] w-6 text-right shrink-0">
                                {stage.open_count}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Totais */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--ds-border-subtle)]">
                <div className="text-center">
                    <p className="text-[10px] text-[var(--ds-text-muted)] uppercase tracking-wide">Abertos</p>
                    <p className="text-sm font-semibold text-[var(--ds-text-primary)]">{totals.open_count}</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-[var(--ds-text-muted)] uppercase tracking-wide">Ganhos</p>
                    <p className="text-sm font-semibold text-emerald-400">{totals.won_count}</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-[var(--ds-text-muted)] uppercase tracking-wide">Conversão</p>
                    <p className="text-sm font-semibold text-zinc-200">{totals.conversion_rate}%</p>
                </div>
            </div>

            {/* Link para o funil completo */}
            <Link
                href="/crm"
                className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--ds-text-muted)] hover:text-emerald-400 transition-colors"
            >
                Ver Funil Completo <ArrowUpRight className="h-3 w-3" />
            </Link>
        </div>
    )
}
