import type {
    PipelineStage,
    Deal,
    DealActivity,
    DealStatus,
    CreatePipelineStageDTO,
    UpdatePipelineStageDTO,
    CreateDealDTO,
    UpdateDealDTO,
    MoveDealDTO,
    CreateDealActivityDTO,
    PipelineMetrics,
} from '../types'

// =============================================================================
// Helpers
// =============================================================================

async function apiFetch<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    })

    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Erro ${res.status}: ${res.statusText}`)
    }

    return res.json()
}

// =============================================================================
// Pipeline Stages
// =============================================================================

export const stageService = {
    /** Lista estágios, opcionalmente filtrados por funil */
    getAll: (funnelId?: string): Promise<PipelineStage[]> => {
        const params = funnelId ? `?funnelId=${encodeURIComponent(funnelId)}` : ''
        return apiFetch(`/api/crm/stages${params}`)
    },

    /** Retorna um estágio pelo ID */
    getById: (id: string): Promise<PipelineStage> =>
        apiFetch(`/api/crm/stages/${id}`),

    /** Cria um novo estágio */
    create: (dto: CreatePipelineStageDTO): Promise<PipelineStage> =>
        apiFetch('/api/crm/stages', {
            method: 'POST',
            body: JSON.stringify(dto),
        }),

    /** Atualiza um estágio */
    update: (id: string, dto: UpdatePipelineStageDTO): Promise<PipelineStage> =>
        apiFetch(`/api/crm/stages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(dto),
        }),

    /** Remove um estágio */
    delete: (id: string): Promise<{ success: boolean }> =>
        apiFetch(`/api/crm/stages/${id}`, { method: 'DELETE' }),
}

// =============================================================================
// Deals
// =============================================================================

export interface DealListParams {
    stageId?: string
    funnelId?: string
    status?: DealStatus
    contactId?: string
    limit?: number
    offset?: number
}

export interface DealListResult {
    data: Deal[]
    total: number
}

export const dealService = {
    /** Lista deals com filtros opcionais */
    list: (params: DealListParams = {}): Promise<DealListResult> => {
        const qs = new URLSearchParams()
        if (params.stageId)   qs.set('stageId', params.stageId)
        if (params.funnelId)  qs.set('funnelId', params.funnelId)
        if (params.status)    qs.set('status', params.status)
        if (params.contactId) qs.set('contactId', params.contactId)
        if (params.limit)     qs.set('limit', String(params.limit))
        if (params.offset)    qs.set('offset', String(params.offset))
        const query = qs.toString() ? `?${qs.toString()}` : ''
        return apiFetch(`/api/crm/deals${query}`)
    },

    /** Retorna um deal pelo ID */
    getById: (id: string): Promise<Deal> =>
        apiFetch(`/api/crm/deals/${id}`),

    /** Cria um novo deal */
    create: (dto: CreateDealDTO): Promise<Deal> =>
        apiFetch('/api/crm/deals', {
            method: 'POST',
            body: JSON.stringify(dto),
        }),

    /** Atualiza campos do deal */
    update: (id: string, dto: UpdateDealDTO): Promise<Deal> =>
        apiFetch(`/api/crm/deals/${id}`, {
            method: 'PUT',
            body: JSON.stringify(dto),
        }),

    /** Move deal para outro estágio */
    move: (id: string, dto: MoveDealDTO): Promise<Deal> =>
        apiFetch(`/api/crm/deals/${id}/move`, {
            method: 'POST',
            body: JSON.stringify(dto),
        }),

    /** Marca deal como ganho */
    markWon: (id: string): Promise<Deal> =>
        dealService.update(id, { status: 'won' }),

    /** Marca deal como perdido */
    markLost: (id: string): Promise<Deal> =>
        dealService.update(id, { status: 'lost' }),

    /** Remove um deal */
    delete: (id: string): Promise<{ success: boolean }> =>
        apiFetch(`/api/crm/deals/${id}`, { method: 'DELETE' }),
}

// =============================================================================
// Deal Activities
// =============================================================================

export const activityService = {
    /** Lista atividades de um deal */
    listByDeal: (dealId: string): Promise<DealActivity[]> =>
        apiFetch(`/api/crm/deals/${dealId}/activities`),

    /** Registra uma nova atividade */
    create: (dealId: string, dto: CreateDealActivityDTO): Promise<DealActivity> =>
        apiFetch(`/api/crm/deals/${dealId}/activities`, {
            method: 'POST',
            body: JSON.stringify(dto),
        }),
}
