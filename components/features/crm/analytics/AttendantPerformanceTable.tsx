'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { AttendantPerformance } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

interface Props {
  data: AttendantPerformance[]
  isLoading: boolean
}

export function AttendantPerformanceTable({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-100">Performance por Atendente</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-zinc-500 py-8 text-sm">Sem dados no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-3 font-medium">Atendente</th>
                  <th className="text-right py-2 px-2 font-medium">Total</th>
                  <th className="text-right py-2 px-2 font-medium">Ganhos</th>
                  <th className="text-right py-2 px-2 font-medium">Perdidos</th>
                  <th className="text-right py-2 px-2 font-medium">Conversão</th>
                  <th className="text-right py-2 pl-2 font-medium">Valor ganho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {data.map((row) => (
                  <tr key={row.attendant} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 pr-3 text-zinc-200 font-medium truncate max-w-[140px]">
                      {row.attendant}
                    </td>
                    <td className="py-2.5 px-2 text-right text-zinc-300">{row.totalDeals}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-400 font-medium">{row.wonDeals}</td>
                    <td className="py-2.5 px-2 text-right text-red-400">{row.lostDeals}</td>
                    <td className="py-2.5 px-2 text-right">
                      <Badge
                        variant="outline"
                        className={
                          row.conversionRate >= 50
                            ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                            : row.conversionRate >= 25
                            ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'
                            : 'border-red-500/50 text-red-400 bg-red-500/10'
                        }
                      >
                        {row.conversionRate}%
                      </Badge>
                    </td>
                    <td className="py-2.5 pl-2 text-right text-zinc-300">{formatCurrency(row.wonValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
