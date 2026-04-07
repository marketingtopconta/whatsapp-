import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stageService } from '@/services/crmService'
import type {
    PipelineStage,
    CreatePipelineStageDTO,
    UpdatePipelineStageDTO,
    FunnelStageConfig,
} from '@/types'

// ---------------------------------------------------------------------------
// Chave de cache
// ---------------------------------------------------------------------------

export const CRM_STAGES_QUERY_KEY = ['crm', 'stages'] as const

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function useCRMStages() {
    const queryClient = useQueryClient()

    // ------- Query -------
    const {
        data: stages = [],
        isLoading,
        error,
        refetch,
    } = useQuery<PipelineStage[]>({
        queryKey: CRM_STAGES_QUERY_KEY,
        queryFn: () => stageService.getAll(),
        staleTime: 30_000,
    })

    // ------- Mutation: criar estágio -------
    const createMutation = useMutation({
        mutationFn: (dto: CreatePipelineStageDTO) => stageService.create(dto),
        onSuccess: (stage) => {
            queryClient.invalidateQueries({ queryKey: CRM_STAGES_QUERY_KEY })
            toast.success(`Estágio "${stage.name}" criado`)
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Falha ao criar estágio')
        },
    })

    // ------- Mutation: atualizar estágio -------
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdatePipelineStageDTO }) =>
            stageService.update(id, dto),
        onMutate: async ({ id, dto }) => {
            // Otimismo: atualiza cache local imediatamente
            await queryClient.cancelQueries({ queryKey: CRM_STAGES_QUERY_KEY })
            const prev = queryClient.getQueryData<PipelineStage[]>(CRM_STAGES_QUERY_KEY)
            if (prev) {
                queryClient.setQueryData<PipelineStage[]>(
                    CRM_STAGES_QUERY_KEY,
                    prev.map((s) =>
                        s.id === id
                            ? {
                                  ...s,
                                  ...(dto.name !== undefined && { name: dto.name }),
                                  ...(dto.color !== undefined && { color: dto.color }),
                                  ...(dto.order !== undefined && { order: dto.order }),
                                  ...(dto.funnelConfig !== undefined && { funnelConfig: dto.funnelConfig }),
                              }
                            : s
                    )
                )
            }
            return { prev }
        },
        onError: (_err: any, _vars, context) => {
            if (context?.prev) {
                queryClient.setQueryData(CRM_STAGES_QUERY_KEY, context.prev)
            }
            toast.error('Falha ao salvar configuração do estágio')
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CRM_STAGES_QUERY_KEY })
            toast.success('Configuração do estágio salva')
        },
    })

    // ------- Mutation: salvar funnel_config de um estágio -------
    const saveFunnelConfig = (stageId: string, funnelConfig: FunnelStageConfig) =>
        updateMutation.mutate({ id: stageId, dto: { funnelConfig } })

    // ------- Mutation: deletar estágio -------
    const deleteMutation = useMutation({
        mutationFn: (id: string) => stageService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CRM_STAGES_QUERY_KEY })
            toast.success('Estágio removido')
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Falha ao remover estágio')
        },
    })

    return {
        stages,
        isLoading,
        error,
        refetch,
        createStage: (dto: CreatePipelineStageDTO) => createMutation.mutate(dto),
        updateStage: (id: string, dto: UpdatePipelineStageDTO) =>
            updateMutation.mutate({ id, dto }),
        saveFunnelConfig,
        deleteStage: (id: string) => deleteMutation.mutate(id),
        isSaving: updateMutation.isPending || createMutation.isPending,
        isDeleting: deleteMutation.isPending,
    }
}
