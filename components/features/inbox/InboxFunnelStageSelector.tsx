'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, GitBranch, Plus, Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StageOption {
  id: string
  name: string
  color: string
  order: number
}

interface FunnelOption {
  id: string
  name: string
  isDefault: boolean
  stages: StageOption[]
}

interface DealInfo {
  id: string
  title: string
  stageId: string
  stageName: string | null
  stageColor: string | null
  funnelId: string
  funnelName: string | null
}

interface PhoneDealData {
  contact: { id: string; name: string; phone: string } | null
  deal: DealInfo | null
  funnels: FunnelOption[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function usePhoneDeal(phone: string | null) {
  const queryClient = useQueryClient()
  const key = ['inbox-crm-deal', phone]

  const query = useQuery<PhoneDealData>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/crm/phone/${encodeURIComponent(phone!)}/deal`)
      if (!res.ok) throw new Error('Erro ao buscar deal')
      return res.json()
    },
    enabled: !!phone,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async (stageId: string) => {
      const res = await fetch(`/api/crm/phone/${encodeURIComponent(phone!)}/deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao atualizar etapa')
      }
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: key })
      const msg = result.action === 'created' ? 'Lead criado no CRM' : 'Etapa atualizada'
      toast.success(msg)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao atualizar etapa')
    },
  })

  return { ...query, setStage: mutation.mutate, isSetting: mutation.isPending }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  phone: string | null
}

export function InboxFunnelStageSelector({ phone }: Props) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, setStage, isSetting } = usePhoneDeal(phone)

  if (!phone) return null

  const deal = data?.deal
  const funnels = data?.funnels ?? []
  const hasFunnels = funnels.some((f) => f.stages.length > 0)

  const handleSelect = (stageId: string) => {
    setStage(stageId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border',
            'max-w-[220px] truncate',
            deal
              ? 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60'
              : 'border-dashed border-zinc-700 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
          )}
          disabled={isLoading || isSetting}
        >
          {isLoading || isSetting ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          ) : deal ? (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: deal.stageColor ?? '#6366f1' }}
            />
          ) : (
            <GitBranch className="h-3 w-3 shrink-0" />
          )}

          <span className="truncate">
            {deal
              ? `${deal.funnelName ? deal.funnelName + ' · ' : ''}${deal.stageName ?? 'Sem etapa'}`
              : 'Adicionar ao funil'}
          </span>

          <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500 ml-auto" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-0 bg-zinc-900 border-zinc-700 shadow-xl"
        align="start"
        sideOffset={6}
      >
        <div className="px-3 py-2 border-b border-zinc-800">
          <p className="text-xs font-semibold text-zinc-300">Etapa do funil</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {deal ? 'Mover para outra etapa' : 'Criar lead nesta etapa'}
          </p>
        </div>

        {!hasFunnels ? (
          <div className="px-3 py-4 text-center text-xs text-zinc-500">
            Nenhum funil configurado
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto py-1">
            {funnels.map((funnel) => (
              <div key={funnel.id}>
                {/* Funil label */}
                <div className="px-3 py-1.5 flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3 text-zinc-600" />
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                    {funnel.name}
                    {funnel.isDefault && (
                      <span className="ml-1 text-emerald-600">· padrão</span>
                    )}
                  </span>
                </div>

                {/* Estágios */}
                {funnel.stages.map((stage) => {
                  const isActive = deal?.stageId === stage.id
                  return (
                    <button
                      key={stage.id}
                      onClick={() => handleSelect(stage.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left transition-colors',
                        isActive
                          ? 'bg-zinc-700/60 text-zinc-100'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color ?? '#6366f1' }}
                      />
                      <span className="flex-1 truncate">{stage.name}</span>
                      {isActive && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Link rápido pro CRM */}
        {deal && (
          <div className="border-t border-zinc-800 px-3 py-2">
            <a
              href="/crm"
              target="_blank"
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Ver no Kanban CRM
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
