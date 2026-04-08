'use client'

/**
 * useCRM — Controller hook do CRM Kanban
 *
 * React Query + Supabase Realtime para atualização ao vivo.
 * Agrupa deals por estágio e expõe mutations otimistas para DnD.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stageService, dealService, activityService } from '@/services/crmService'
import {
    createRealtimeChannel,
    subscribeToTable,
    activateChannel,
    removeChannel,
} from '@/lib/supabase-realtime'
import type {
    PipelineStage,
    Deal,
    DealActivity,
    DealStatus,
    CreateDealDTO,
    UpdateDealDTO,
    CreateDealActivityDTO,
} from '@/types'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const CRM_KEYS = {
    stages: ['crm', 'stages'] as const,
    deals: (stageId?: string) => ['crm', 'deals', stageId ?? 'all'] as const,
    allDeals: ['crm', 'deals', 'all'] as const,
    deal: (id: string) => ['crm', 'deal', id] as const,
    activities: (dealId: string) => ['crm', 'activities', dealId] as const,
} as const

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function useCRM(funnelId?: string) {
    const queryClient = useQueryClient()
    const channelRef = useRef<ReturnType<typeof createRealtimeChannel> | null>(null)

    // -----------------------------------------------------------------------
    // Queries (filtradas por funil quando funnelId é fornecido)
    // -----------------------------------------------------------------------

    const { data: stages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
        queryKey: [...CRM_KEYS.stages, funnelId ?? 'all'],
        queryFn: () => stageService.getAll(funnelId),
        staleTime: 60_000,
    })

    const { data: dealsResult, isLoading: dealsLoading } = useQuery({
        queryKey: [...CRM_KEYS.allDeals, funnelId ?? 'all'],
        queryFn: () => dealService.list({ limit: 500, funnelId }),
        staleTime: 15_000,
    })

    const allDeals: Deal[] = dealsResult?.data ?? []

    // Derived: deals agrupados por stageId
    const dealsByStage = useMemo(() => {
        const map = new Map<string, Deal[]>()
        for (const deal of allDeals) {
            const list = map.get(deal.stageId) ?? []
            list.push(deal)
            map.set(deal.stageId, list)
        }
        // Ordena cada coluna por createdAt (mais recentes primeiro)
        for (const [key, list] of map.entries()) {
            map.set(
                key,
                [...list].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
            )
        }
        return map
    }, [allDeals])

    const isLoading = stagesLoading || dealsLoading

    // -----------------------------------------------------------------------
    // Supabase Realtime — escuta alterações em deals
    // -----------------------------------------------------------------------

    const invalidateDeals = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
    }, [queryClient])

    useEffect(() => {
        const channel = createRealtimeChannel('crm-deals-realtime')
        if (!channel) return

        channelRef.current = channel

        subscribeToTable(channel, 'deals', '*', () => {
            invalidateDeals()
        })

        activateChannel(channel, undefined, { silent: true }).catch(() => {
            // Best-effort: silencia erro de conexão
        })

        return () => {
            if (channelRef.current) {
                removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [invalidateDeals])

    // -----------------------------------------------------------------------
    // Mutations
    // -----------------------------------------------------------------------

    // Criar deal
    const createMutation = useMutation({
        mutationFn: (dto: CreateDealDTO) => dealService.create(dto),
        onSuccess: (deal) => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
            toast.success(`Deal "${deal.title}" criado`)
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Falha ao criar deal')
        },
    })

    // Mover deal (DnD) — otimismo
    const moveMutation = useMutation({
        mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
            dealService.move(dealId, { stageId }),
        onMutate: async ({ dealId, stageId }) => {
            await queryClient.cancelQueries({ queryKey: CRM_KEYS.allDeals })
            const prev = queryClient.getQueryData<{ data: Deal[]; total: number }>(
                CRM_KEYS.allDeals
            )
            if (prev) {
                queryClient.setQueryData<{ data: Deal[]; total: number }>(
                    CRM_KEYS.allDeals,
                    {
                        ...prev,
                        data: prev.data.map((d) =>
                            d.id === dealId ? { ...d, stageId } : d
                        ),
                    }
                )
            }
            return { prev }
        },
        onError: (_err: any, _vars, context) => {
            if (context?.prev) {
                queryClient.setQueryData(CRM_KEYS.allDeals, context.prev)
            }
            toast.error('Falha ao mover deal')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
        },
    })

    // Atualizar deal
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateDealDTO }) =>
            dealService.update(id, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Falha ao atualizar deal')
        },
    })

    // Marcar como ganho
    const markWonMutation = useMutation({
        mutationFn: (id: string) => dealService.markWon(id),
        onSuccess: (deal) => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
            toast.success(`Deal "${deal.title}" marcado como ganho`)
        },
        onError: (err: any) => toast.error(err?.message || 'Falha'),
    })

    // Marcar como perdido
    const markLostMutation = useMutation({
        mutationFn: (id: string) => dealService.markLost(id),
        onSuccess: (deal) => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
            toast.success(`Deal "${deal.title}" marcado como perdido`)
        },
        onError: (err: any) => toast.error(err?.message || 'Falha'),
    })

    // Deletar deal
    const deleteMutation = useMutation({
        mutationFn: (id: string) => dealService.delete(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: CRM_KEYS.allDeals })
            const prev = queryClient.getQueryData<{ data: Deal[]; total: number }>(
                CRM_KEYS.allDeals
            )
            if (prev) {
                queryClient.setQueryData<{ data: Deal[]; total: number }>(CRM_KEYS.allDeals, {
                    ...prev,
                    data: prev.data.filter((d) => d.id !== id),
                    total: prev.total - 1,
                })
            }
            return { prev }
        },
        onError: (_err: any, _vars, context) => {
            if (context?.prev) queryClient.setQueryData(CRM_KEYS.allDeals, context.prev)
            toast.error('Falha ao remover deal')
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
            toast.success('Deal removido')
        },
    })

    return {
        stages,
        allDeals,
        dealsByStage,
        isLoading,
        // Mutations
        createDeal: (dto: CreateDealDTO) => createMutation.mutate(dto),
        moveDeal: (dealId: string, stageId: string) =>
            moveMutation.mutate({ dealId, stageId }),
        updateDeal: (id: string, dto: UpdateDealDTO) =>
            updateMutation.mutate({ id, dto }),
        markWon: (id: string) => markWonMutation.mutate(id),
        markLost: (id: string) => markLostMutation.mutate(id),
        deleteDeal: (id: string) => deleteMutation.mutate(id),
        isCreating: createMutation.isPending,
        isMoving: moveMutation.isPending,
        // Refetch manual
        refetch: invalidateDeals,
    }
}

// ---------------------------------------------------------------------------
// Hook de atividades de um deal
// ---------------------------------------------------------------------------

export function useDealActivities(dealId: string | null) {
    const queryClient = useQueryClient()

    const { data: activities = [], isLoading } = useQuery<DealActivity[]>({
        queryKey: CRM_KEYS.activities(dealId ?? ''),
        queryFn: () => activityService.listByDeal(dealId!),
        enabled: !!dealId,
        staleTime: 10_000,
    })

    const addNoteMutation = useMutation({
        mutationFn: (dto: CreateDealActivityDTO) =>
            activityService.create(dealId!, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.activities(dealId ?? '') })
        },
        onError: (err: any) => toast.error(err?.message || 'Falha ao salvar nota'),
    })

    return {
        activities,
        isLoading,
        addNote: (body: string) =>
            addNoteMutation.mutate({ type: 'note', body }),
        isAddingNote: addNoteMutation.isPending,
    }
}
