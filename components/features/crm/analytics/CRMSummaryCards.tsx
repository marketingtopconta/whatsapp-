'use client'

import { TrendingUp, Users, CheckCircle, XCircle, DollarSign, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { CRMSummary } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface CardItemProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
}

function SummaryCard({ label, value, sub, icon, color }: CardItemProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

interface Props {
  summary?: CRMSummary
  isLoading: boolean
  periodLabel?: string
}

export function CRMSummaryCards({ summary, isLoading, periodLabel }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5 pb-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!summary) return null

  const cards: CardItemProps[] = [
    {
      label: 'Leads no período',
      value: String(summary.newLeadsPeriod),
      sub: periodLabel,
      icon: <Users className="w-4 h-4 text-blue-400" />,
      color: 'bg-blue-500/10',
    },
    {
      label: 'Negócios abertos',
      value: String(summary.openDeals),
      sub: formatCurrency(summary.totalValueOpen),
      icon: <Target className="w-4 h-4 text-yellow-400" />,
      color: 'bg-yellow-500/10',
    },
    {
      label: 'Ganhos',
      value: String(summary.wonDeals),
      sub: formatCurrency(summary.totalValueWon),
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
      color: 'bg-emerald-500/10',
    },
    {
      label: 'Perdidos',
      value: String(summary.lostDeals),
      icon: <XCircle className="w-4 h-4 text-red-400" />,
      color: 'bg-red-500/10',
    },
    {
      label: 'Taxa de conversão',
      value: `${summary.conversionRate}%`,
      sub: 'ganhos / (ganhos+perdidos)',
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      color: 'bg-emerald-500/10',
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(summary.avgDealValue),
      sub: 'negócios abertos',
      icon: <DollarSign className="w-4 h-4 text-purple-400" />,
      color: 'bg-purple-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => (
        <SummaryCard key={c.label} {...c} />
      ))}
    </div>
  )
}
