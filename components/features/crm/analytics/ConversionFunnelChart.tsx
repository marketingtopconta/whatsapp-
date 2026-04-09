'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { StageConversionRate } from '@/types'

function formatTime(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

interface Props {
  data: StageConversionRate[]
  isLoading: boolean
}

export function ConversionFunnelChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const maxDeals = Math.max(...data.map((s) => s.totalDeals), 1)

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-100">Funil de Conversão por Estágio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 && (
          <p className="text-center text-zinc-500 py-8 text-sm">Sem dados no período</p>
        )}
        {data.map((stage) => {
          const widthPct = maxDeals > 0 ? (stage.totalDeals / maxDeals) * 100 : 0
          const color = stage.stageColor || '#6366f1'
          return (
            <div key={stage.stageId} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-300 truncate max-w-[60%]">{stage.stageName}</span>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span>{stage.totalDeals} leads</span>
                  <span className="text-emerald-400 font-medium">{stage.conversionRate}%</span>
                  {stage.avgTimeSeconds > 0 && (
                    <span className="text-zinc-500">{formatTime(stage.avgTimeSeconds)}</span>
                  )}
                </div>
              </div>
              <div className="h-7 bg-zinc-800 rounded-md overflow-hidden relative">
                <div
                  className="h-full rounded-md transition-all duration-500 flex items-center px-2"
                  style={{ width: `${widthPct}%`, backgroundColor: color + '55', borderLeft: `3px solid ${color}` }}
                >
                  {stage.wonFromStage > 0 && (
                    <span className="text-[10px] text-white/70">{stage.wonFromStage} ganhos</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
