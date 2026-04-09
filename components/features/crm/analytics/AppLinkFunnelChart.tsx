'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Smartphone, MousePointerClick, Download, UserCheck, ShoppingCart } from 'lucide-react'

interface FunnelData {
  sent: number
  clicked: number
  installed: number
  accountOpened: number
  firstPurchase: number
  clickRate: number
  installRate: number
  conversionRate: number
}

interface Props {
  startDate?: string
  endDate?: string
}

function useLinkFunnel(startDate?: string, endDate?: string) {
  return useQuery<FunnelData>({
    queryKey: ['app-link-funnel', startDate, endDate],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (startDate) p.set('startDate', startDate)
      if (endDate) p.set('endDate', endDate)
      const res = await fetch(`/api/crm/analytics/links?${p}`)
      if (!res.ok) throw new Error('Erro ao buscar funil de links')
      return res.json()
    },
    staleTime: 60_000,
  })
}

const STEPS = [
  { key: 'sent',         label: 'Link Enviado',     icon: Smartphone,        color: '#6366f1' },
  { key: 'clicked',      label: 'Clicou no Link',   icon: MousePointerClick, color: '#3b82f6' },
  { key: 'installed',    label: 'Baixou o App',     icon: Download,          color: '#f59e0b' },
  { key: 'accountOpened',label: 'Abriu a Conta',    icon: UserCheck,         color: '#10b981' },
  { key: 'firstPurchase',label: 'Primeira Compra',  icon: ShoppingCart,      color: '#8b5cf6' },
] as const

export function AppLinkFunnelChart({ startDate, endDate }: Props) {
  const { data, isLoading } = useLinkFunnel(startDate, endDate)

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </CardContent>
      </Card>
    )
  }

  const values: Record<string, number> = {
    sent:          data?.sent ?? 0,
    clicked:       data?.clicked ?? 0,
    installed:     data?.installed ?? 0,
    accountOpened: data?.accountOpened ?? 0,
    firstPurchase: data?.firstPurchase ?? 0,
  }

  const maxVal = Math.max(...Object.values(values), 1)

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-100">
          Funil de Conversão do App
        </CardTitle>
        <p className="text-xs text-zinc-500 mt-0.5">
          Da campanha até a primeira compra · cliques rastreados via link único
          {(data?.installed ?? 0) === 0 && (
            <span className="ml-2 text-amber-500">
              · installs/conta requerem AppsFlyer configurado
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {STEPS.map((step, idx) => {
          const val = values[step.key]
          const prev = idx > 0 ? values[STEPS[idx - 1].key] : val
          const dropPct = prev > 0 && idx > 0 ? Math.round((1 - val / prev) * 100) : null
          const widthPct = (val / maxVal) * 100
          const Icon = step.icon

          return (
            <div key={step.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: step.color }} />
                  <span className="text-xs text-zinc-300">{step.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-zinc-100">{val.toLocaleString('pt-BR')}</span>
                  {dropPct !== null && dropPct > 0 && (
                    <span className="text-red-400 text-[11px]">-{dropPct}%</span>
                  )}
                  {dropPct !== null && dropPct === 0 && (
                    <span className="text-emerald-400 text-[11px]">100%</span>
                  )}
                </div>
              </div>
              <div className="h-8 bg-zinc-800 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-700 flex items-center px-2"
                  style={{
                    width: `${Math.max(widthPct, val > 0 ? 4 : 0)}%`,
                    backgroundColor: step.color + '33',
                    borderLeft: `3px solid ${step.color}`,
                  }}
                >
                  {val > 0 && (
                    <span className="text-[10px] text-white/60">
                      {idx > 0 && prev > 0 ? `${Math.round(val / prev * 100)}% do anterior` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Resumo de taxas */}
        <div className="flex gap-4 pt-2 border-t border-zinc-800 mt-3">
          <div className="text-center">
            <p className="text-xs text-zinc-500">Taxa de clique</p>
            <p className="text-lg font-bold text-blue-400">{data?.clickRate ?? 0}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500">Clique → Install</p>
            <p className="text-lg font-bold text-amber-400">{data?.installRate ?? 0}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500">Enviado → Conta</p>
            <p className="text-lg font-bold text-emerald-400">{data?.conversionRate ?? 0}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
