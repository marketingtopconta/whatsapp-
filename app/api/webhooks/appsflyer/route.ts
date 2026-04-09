import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/webhooks/appsflyer
 * Recebe postbacks da AppsFlyer com eventos do app.
 *
 * Configurar na AppsFlyer:
 *   Active Postback URL: https://SEU_DOMINIO/api/webhooks/appsflyer
 *   Eventos: install, af_complete_registration, af_purchase
 *
 * A AppsFlyer envia af_sub1 = token que criamos no envio do template.
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 })

  let body: Record<string, any> = {}
  try {
    const text = await request.text()
    // AppsFlyer pode enviar como JSON ou form-encoded
    if (text.startsWith('{')) {
      body = JSON.parse(text)
    } else {
      body = Object.fromEntries(new URLSearchParams(text))
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const eventName: string = body.event_name ?? body.af_event_type ?? ''
  const token: string = body.af_sub1 ?? ''
  const now = new Date().toISOString()

  // ---------------------------------------------------------------------------
  // Identifica o token e o evento
  // ---------------------------------------------------------------------------

  if (!token) {
    // Sem token — não conseguimos correlacionar com um deal
    return NextResponse.json({ ok: true, skipped: 'no_token' })
  }

  const { data: linkToken, error } = await supabase
    .from('app_link_tokens')
    .select('id, deal_id, contact_id, phone, click_count, installed_at')
    .eq('token', token)
    .single()

  if (error || !linkToken) {
    return NextResponse.json({ ok: true, skipped: 'token_not_found' })
  }

  // Dados de atribuição do AppsFlyer para enriquecer o registro
  const afData = {
    af_install_id: body.appsflyer_id ?? body.af_id ?? null,
    af_campaign: body.campaign ?? body.c ?? null,
    af_adset: body.af_adset ?? null,
    af_ad: body.af_ad ?? null,
    af_media_source: body.media_source ?? body.pid ?? null,
    af_raw: body,
    updated_at: now,
  }

  // ---------------------------------------------------------------------------
  // Processa o evento
  // ---------------------------------------------------------------------------

  const eventLower = eventName.toLowerCase()

  // 1. Install (baixou o app)
  if (eventLower === 'install' || eventLower === 'af_install') {
    if (!linkToken.installed_at) {
      await supabase
        .from('app_link_tokens')
        .update({ installed_at: now, ...afData })
        .eq('token', token)

      // Move deal para estágio "Baixou o App" (best-effort)
      if (linkToken.deal_id) {
        await moveDealToStage(supabase, linkToken.deal_id, ['baixou', 'instalou', 'app'])
      }
    }
  }

  // 2. Registro / conta aberta
  else if (
    eventLower === 'af_complete_registration' ||
    eventLower === 'complete_registration' ||
    eventLower === 'account_created' ||
    eventLower === 'af_registration'
  ) {
    await supabase
      .from('app_link_tokens')
      .update({ account_opened_at: now, ...afData })
      .eq('token', token)

    // Move deal para estágio "Conta Aberta"
    if (linkToken.deal_id) {
      await moveDealToStage(supabase, linkToken.deal_id, ['conta', 'aberta', 'criada', 'cadastro'])
    }
  }

  // 3. Primeira compra
  else if (
    eventLower === 'af_purchase' ||
    eventLower === 'purchase' ||
    eventLower === 'first_purchase'
  ) {
    await supabase
      .from('app_link_tokens')
      .update({ first_purchase_at: now, ...afData })
      .eq('token', token)

    // Marca o deal como ganho
    if (linkToken.deal_id) {
      await supabase
        .from('deals')
        .update({ status: 'won', won_at: now, updated_at: now })
        .eq('id', linkToken.deal_id)
        .eq('status', 'open')
    }
  }

  return NextResponse.json({ ok: true, event: eventName, token })
}

// ---------------------------------------------------------------------------
// Helper: move deal para estágio por palavras-chave no nome
// ---------------------------------------------------------------------------

async function moveDealToStage(
  supabase: any,
  dealId: string,
  keywords: string[]
): Promise<void> {
  const { data: deal } = await supabase
    .from('deals')
    .select('id, funnel_id, stage_id')
    .eq('id', dealId)
    .single()

  if (!deal) return

  const orFilter = keywords.map((k) => `name.ilike.%${k}%`).join(',')
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('funnel_id', deal.funnel_id)
    .or(orFilter)
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
