'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Trigger, CreateTriggerDTO, UpdateTriggerDTO, TriggerAction, TriggerExecutionLog } from '@/types'

export const TRIGGERS_KEY = (funnelId?: string) => ['crm', 'triggers', funnelId ?? 'all']
export const TRIGGER_LOG_KEY = (dealId?: string) => ['crm', 'trigger-log', dealId ?? 'all']

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Erro ${res.status}`)
    }
    return res.json()
}

export function useTriggers(funnelId?: string) {
    const qc = useQueryClient()

    const { data: triggers = [], isLoading, refetch } = useQuery<Trigger[]>({
        queryKey: TRIGGERS_KEY(funnelId),
        queryFn: () => {
            const params = funnelId ? `?funnelId=${encodeURIComponent(funnelId)}` : ''
            return apiFetch<Trigger[]>(`/api/crm/triggers${params}`)
        },
        staleTime: 30_000,
    })

    const invalidate = () => qc.invalidateQueries({ queryKey: ['crm', 'triggers'] })

    const createMutation = useMutation({
        mutationFn: (dto: CreateTriggerDTO) =>
            apiFetch<Trigger>('/api/crm/triggers', { method: 'POST', body: JSON.stringify(dto) }),
        onSuccess: invalidate,
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateTriggerDTO }) =>
            apiFetch<Trigger>(`/api/crm/triggers/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
        onSuccess: invalidate,
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) =>
            apiFetch<{ success: boolean }>(`/api/crm/triggers/${id}`, { method: 'DELETE' }),
        onSuccess: invalidate,
    })

    const updateActionsMutation = useMutation({
        mutationFn: ({ id, actions }: { id: string; actions: Omit<TriggerAction, 'id' | 'triggerId' | 'createdAt'>[] }) =>
            apiFetch<TriggerAction[]>(`/api/crm/triggers/${id}/actions`, {
                method: 'PUT',
                body: JSON.stringify(actions),
            }),
        onSuccess: invalidate,
    })

    const toggleActive = (trigger: Trigger) =>
        updateMutation.mutateAsync({ id: trigger.id, dto: { isActive: !trigger.isActive } })

    return {
        triggers,
        isLoading,
        refetch,
        createTrigger: createMutation.mutateAsync,
        updateTrigger: (id: string, dto: UpdateTriggerDTO) => updateMutation.mutateAsync({ id, dto }),
        deleteTrigger: deleteMutation.mutateAsync,
        updateActions: (id: string, actions: Omit<TriggerAction, 'id' | 'triggerId' | 'createdAt'>[]) =>
            updateActionsMutation.mutateAsync({ id, actions }),
        toggleActive,
        isCreating: createMutation.isPending,
        isSaving: updateMutation.isPending || updateActionsMutation.isPending,
    }
}

export function useTriggerLog(dealId?: string) {
    return useQuery<TriggerExecutionLog[]>({
        queryKey: TRIGGER_LOG_KEY(dealId),
        queryFn: () => {
            const params = dealId ? `?dealId=${encodeURIComponent(dealId)}` : ''
            return apiFetch<TriggerExecutionLog[]>(`/api/crm/triggers/log${params}`)
        },
        staleTime: 15_000,
        enabled: true,
    })
}
