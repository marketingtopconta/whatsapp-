/**
 * Utilitários para geração e gestão de tokens de link rastreável do app
 * Cada token corresponde a um envio único (deal + template + campanha)
 */

import { getSupabaseAdmin } from '@/lib/supabase'

// URL base do OneLink da ToiConta
const ONELINK_BASE = 'https://topconta.onelink.me/tLP0/ggu32wi3'

// ---------------------------------------------------------------------------
// Geração de token
// ---------------------------------------------------------------------------

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

// ---------------------------------------------------------------------------
// Cria um token para um envio
// ---------------------------------------------------------------------------

export interface CreateAppLinkOptions {
  dealId?: string | null
  contactId?: string | null
  campaignContactId?: string | null
  phone?: string | null
  templateName?: string | null
  campaignName?: string | null
}

export async function createAppLinkToken(opts: CreateAppLinkOptions): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  // Tenta até 3 vezes para garantir unicidade do token
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateToken()
    const { error } = await supabase.from('app_link_tokens').insert({
      token,
      deal_id: opts.dealId ?? null,
      contact_id: opts.contactId ?? null,
      campaign_contact_id: opts.campaignContactId ?? null,
      phone: opts.phone ?? null,
      template_name: opts.templateName ?? null,
      campaign_name: opts.campaignName ?? null,
    })
    if (!error) return token
  }
  return null
}

// ---------------------------------------------------------------------------
// Constrói a URL rastreável completa
// ---------------------------------------------------------------------------

export function buildTrackedUrl(token: string, baseUrl: string): string {
  // baseUrl = domínio do SmartZap (ex: https://smartzap.topconta.com.br)
  return `${baseUrl}/api/r/${token}`
}

// ---------------------------------------------------------------------------
// Constrói a URL de destino (OneLink com parâmetros de atribuição)
// ---------------------------------------------------------------------------

export function buildOneLinkUrl(token: string, phone?: string | null, campaignName?: string | null): string {
  const url = new URL(ONELINK_BASE)
  // af_sub1 = token para correlacionar com o deal no postback
  url.searchParams.set('af_sub1', token)
  // af_sub2 = telefone (opcional, para fallback de matching)
  if (phone) url.searchParams.set('af_sub2', phone.replace(/\D/g, ''))
  // af_sub3 = campanha
  if (campaignName) url.searchParams.set('af_sub3', campaignName)
  // fonte = smartzap
  url.searchParams.set('pid', 'smartzap')
  if (campaignName) url.searchParams.set('c', campaignName)
  return url.toString()
}

// ---------------------------------------------------------------------------
// Registra o clique e retorna a URL de destino
// ---------------------------------------------------------------------------

export async function processLinkClick(token: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return buildOneLinkUrl(token)

  const { data, error } = await supabase
    .from('app_link_tokens')
    .select('id, phone, campaign_name, deal_id, click_count')
    .eq('token', token)
    .single()

  if (error || !data) {
    // Token não encontrado → redireciona para o OneLink sem tracking
    return buildOneLinkUrl(token)
  }

  // Atualiza contagem de cliques e timestamp (apenas o primeiro clique define clicked_at)
  const now = new Date().toISOString()
  await supabase
    .from('app_link_tokens')
    .update({
      clicked_at: data.click_count === 0 ? now : undefined,
      click_count: (data.click_count ?? 0) + 1,
      store_reached_at: data.click_count === 0 ? now : undefined,
    })
    .eq('token', token)

  // Se tem deal vinculado, move para estágio "Clicou no Link" (best-effort)
  if (data.deal_id) {
    moveToClickedStage(data.deal_id).catch(() => {})
  }

  return buildOneLinkUrl(token, data.phone, data.campaign_name)
}

// ---------------------------------------------------------------------------
// Move o deal para o primeiro estágio com "clicou" no nome (best-effort)
// ---------------------------------------------------------------------------

async function moveToClickedStage(dealId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return

  // Busca o deal para saber o funil
  const { data: deal } = await supabase
    .from('deals')
    .select('id, funnel_id, stage_id')
    .eq('id', dealId)
    .single()

  if (!deal) return

  // Procura estágio com "clicou" ou "link" no nome no mesmo funil
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('funnel_id', deal.funnel_id)
    .or('name.ilike.%clicou%,name.ilike.%link%,name.ilike.%loja%')
    .order('order', { ascending: true })
    .limit(1)
    .single()

  if (!stage || stage.id === deal.stage_id) return

  const now = new Date().toISOString()
  await supabase
    .from('deals')
    .update({ stage_id: stage.id, entered_stage_at: now, updated_at: now })
    .eq('id', dealId)
}
