import { useQuery } from '@tanstack/react-query'
import type { PipelineMetricsResponse } from '@/app/api/crm/metrics/route'

export const PIPELINE_METRICS_KEY = ['crm', 'pipeline-metrics'] as const

async function fetchPipelineMetrics(): Promise<PipelineMetricsResponse> {
    const res = await fetch('/api/crm/metrics', { cache: 'no-store' })
    if (!res.ok) throw new Error('Falha ao buscar métricas do funil')
    return res.json()
}

/**
 * Hook React Query para métricas do pipeline CRM.
 * Usado pelo widget do dashboard e pela tela de funil.
 *
 * staleTime: 60s — métricas não precisam de realtime agressivo.
 */
export function usePipelineMetrics() {
    return useQuery<PipelineMetricsResponse>({
        queryKey: PIPELINE_METRICS_KEY,
        queryFn: fetchPipelineMetrics,
        staleTime: 60_000,
        placeholderData: (prev) => prev,
    })
}
