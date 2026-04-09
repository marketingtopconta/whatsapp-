'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCRMAnalytics } from '@/hooks/useCRMAnalytics'
import { useFunnels } from '@/hooks/useFunnels'
import { CRMSummaryCards } from '@/components/features/crm/analytics/CRMSummaryCards'
import { ConversionFunnelChart } from '@/components/features/crm/analytics/ConversionFunnelChart'
import { LeadsTimelineChart } from '@/components/features/crm/analytics/LeadsTimelineChart'
import { AttendantPerformanceTable } from '@/components/features/crm/analytics/AttendantPerformanceTable'
import { LeadsBySourceChart } from '@/components/features/crm/analytics/LeadsBySourceChart'
import type { CRMAnalyticsParams } from '@/types'

const PERIOD_OPTIONS = [
  { label: 'Últimos 7 dias', value: '7' },
  { label: 'Últimos 30 dias', value: '30' },
  { label: 'Últimos 60 dias', value: '60' },
  { label: 'Últimos 90 dias', value: '90' },
]

export default function CRMAnalyticsPage() {
  const [funnelId, setFunnelId] = useState<string>('all')
  const [days, setDays] = useState('30')

  const { funnels } = useFunnels()

  const params = useMemo<CRMAnalyticsParams>(() => {
    const d = parseInt(days, 10)
    const now = new Date()
    const start = new Date(now.getTime() - d * 24 * 60 * 60 * 1000)
    return {
      funnelId: funnelId === 'all' ? null : funnelId,
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      days: d,
    }
  }, [funnelId, days])

  const { summary, conversionRates, timeline, attendants, bySource, isLoading, refetch } =
    useCRMAnalytics(params)

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === days)?.label ?? ''
  const selectedFunnel = funnels.find((f) => f.id === funnelId)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/crm">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100 h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Analytics do CRM</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {selectedFunnel ? selectedFunnel.name : 'Todos os funis'} · {periodLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Funil */}
          <Select value={funnelId} onValueChange={setFunnelId}>
            <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-zinc-200 text-sm h-8">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
              <SelectValue placeholder="Funil" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-200">Todos os funis</SelectItem>
              {funnels.map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-zinc-200">
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Período */}
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-zinc-200 text-sm h-8">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-zinc-200">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
            onClick={refetch}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <CRMSummaryCards summary={summary} isLoading={isLoading} periodLabel={periodLabel} />

      {/* Timeline */}
      <LeadsTimelineChart data={timeline} isLoading={isLoading} />

      {/* Funil de conversão + Origem */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConversionFunnelChart data={conversionRates} isLoading={isLoading} />
        <LeadsBySourceChart data={bySource} isLoading={isLoading} />
      </div>

      {/* Atendentes */}
      <AttendantPerformanceTable data={attendants} isLoading={isLoading} />
    </div>
  )
}
