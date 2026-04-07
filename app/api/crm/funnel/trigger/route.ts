import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/auth'
import { executeFunnelStep } from '@/lib/funnel-executor'
import { dealDb } from '@/lib/supabase-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/crm/funnel/trigger
 *
 * Endpoint chamado pelo QStash para executar o próximo passo do funil automático.
 * Autenticado via SMARTZAP_API_KEY (adicionado como header pelo funnel-executor ao publicar no QStash).
 *
 * Body: { dealId: string }
 */
export async function POST(request: NextRequest) {
    const auth = await verifyApiKey(request)
    if (!auth.valid) {
        return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    let body: { dealId?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { dealId } = body
    if (!dealId) {
        return NextResponse.json({ error: 'dealId é obrigatório' }, { status: 400 })
    }

    // Verifica se o deal ainda existe e está aberto antes de executar
    const deal = await dealDb.getById(dealId)
    if (!deal) {
        // Deal removido — retorna 200 para o QStash não re-tentar
        console.warn(`[FunnelTrigger] Deal ${dealId} não encontrado — ignorando trigger.`)
        return NextResponse.json({ status: 'skipped', reason: 'deal_not_found' })
    }
    if (deal.status !== 'open') {
        console.log(`[FunnelTrigger] Deal ${dealId} com status "${deal.status}" — ignorando trigger.`)
        return NextResponse.json({ status: 'skipped', reason: `deal_status_${deal.status}` })
    }

    const requestOrigin = (() => {
        const proto = request.headers.get('x-forwarded-proto') || 'https'
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
        if (!host) return undefined
        return `${proto}://${host}`
    })()

    try {
        const result = await executeFunnelStep(dealId, requestOrigin)
        console.log(`[FunnelTrigger] Deal ${dealId}:`, result)
        return NextResponse.json({ status: 'ok', ...result })
    } catch (error: any) {
        const msg = error?.message || String(error)
        console.error('[FunnelTrigger] Erro ao executar passo do funil:', msg)
        // 500 faz o QStash re-tentar (retries: 2 configurado no executor)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
