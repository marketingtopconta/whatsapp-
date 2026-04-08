'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Funnel, CreateFunnelDTO, UpdateFunnelDTO } from '@/types'

export const FUNNELS_KEY = ['crm', 'funnels']

// =============================================================================
// Service helpers
// =============================================================================

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    })
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Erro ${res.status}`)
    }
    return res.json()
}

// =============================================================================
// Hook principal
// =============================================================================

export function useFunnels() {
    const qc = useQueryClient()

    // Lista todos os funis
    const { data: funnels = [], isLoading, error, refetch } = useQuery<Funnel[]>({
        queryKey: FUNNELS_KEY,
        queryFn: () => apiFetch<Funnel[]>('/api/crm/funnels'),
        staleTime: 30_000,
    })

    // Funil padrão
    const defaultFunnel = funnels.find((f) => f.isDefault) ?? funnels[0] ?? null

    // Criar funil
    const createMutation = useMutation({
        mutationFn: (dto: CreateFunnelDTO) =>
            apiFetch<Funnel>('/api/crm/funnels', {
                method: 'POST',
                body: JSON.stringify(dto),
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: FUNNELS_KEY }),
    })

    // Atualizar funil
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateFunnelDTO }) =>
            apiFetch<Funnel>(`/api/crm/funnels/${id}`, {
                method: 'PUT',
                body: JSON.stringify(dto),
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: FUNNELS_KEY }),
    })

    // Remover funil
    const deleteMutation = useMutation({
        mutationFn: (id: string) =>
            apiFetch<{ success: boolean }>(`/api/crm/funnels/${id}`, { method: 'DELETE' }),
        onSuccess: () => qc.invalidateQueries({ queryKey: FUNNELS_KEY }),
    })

    // Duplicar funil
    const duplicateMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) =>
            apiFetch<Funnel>(`/api/crm/funnels/${id}/duplicate`, {
                method: 'POST',
                body: JSON.stringify({ name }),
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: FUNNELS_KEY }),
    })

    // Definir como padrão
    const setDefault = (id: string) =>
        updateMutation.mutateAsync({ id, dto: { isDefault: true } })

    return {
        funnels,
        defaultFunnel,
        isLoading,
        error,
        refetch,
        createFunnel: createMutation.mutateAsync,
        updateFunnel: (id: string, dto: UpdateFunnelDTO) =>
            updateMutation.mutateAsync({ id, dto }),
        deleteFunnel: deleteMutation.mutateAsync,
        duplicateFunnel: (id: string, name: string) =>
            duplicateMutation.mutateAsync({ id, name }),
        setDefault,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    }
}
