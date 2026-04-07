import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { normalizePhoneNumber } from '@/lib/phone-formatter'

export const dynamic = 'force-dynamic'

export interface InboxDealInfo {
    deal_id: string
    deal_title: string
    stage_id: string
    stage_name: string
    stage_color: string
    next_action_at: string | null
}

/**
 * GET /api/crm/deals/inbox?phones=+5511...&phones=+5522...
 *
 * Rota pública interna (sem autenticação — chamada client-side do Inbox).
 * Retorna um mapa phone → deal ativo (open) para exibir badges no Inbox.
 *
 * Aceita múltiplos `phones` como query params repetidos ou comma-separated.
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url)

    // Aceita ?phones=+55...&phones=+55... ou ?phones=+55...,+55...
    const rawPhones = url.searchParams.getAll('phones').flatMap((p) => p.split(','))
    const phones = [...new Set(rawPhones.map((p) => normalizePhoneNumber(p.trim())).filter(Boolean))]

    if (phones.length === 0) {
        return NextResponse.json({})
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        return NextResponse.json({})
    }

    try {
        // Busca deals abertos cujos contatos têm os phones fornecidos
        const { data, error } = await supabase
            .from('deals')
            .select(`
                id,
                title,
                stage_id,
                next_action_at,
                contacts!inner(phone),
                pipeline_stages!inner(name, color)
            `)
            .eq('status', 'open')
            .in('contacts.phone', phones)
            .order('created_at', { ascending: false })

        if (error) throw error

        // Monta mapa phone → primeiro deal ativo (mais recente)
        const map: Record<string, InboxDealInfo> = {}
        for (const row of (data ?? []) as any[]) {
            const phone = row.contacts?.phone
            if (!phone || map[phone]) continue // Usa apenas o primeiro (mais recente)
            map[phone] = {
                deal_id: row.id,
                deal_title: row.title,
                stage_id: row.stage_id,
                stage_name: row.pipeline_stages?.name ?? '',
                stage_color: row.pipeline_stages?.color ?? '#6366f1',
                next_action_at: row.next_action_at ?? null,
            }
        }

        return NextResponse.json(map, {
            headers: { 'Cache-Control': 'no-store' },
        })
    } catch (error: any) {
        console.error('[CRM Inbox Deals] Erro:', error)
        return NextResponse.json({})
    }
}
