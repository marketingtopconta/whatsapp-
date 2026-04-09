import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'

interface RouteParams {
  params: Promise<{ phone: string }>
}

// ---------------------------------------------------------------------------
// GET — retorna o deal ativo do contato + estágios disponíveis
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { phone } = await params
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  const decodedPhone = decodeURIComponent(phone)

  // Busca o contato pelo telefone (com/sem +)
  const phoneVariants = [decodedPhone, decodedPhone.replace(/^\+/, ''), `+${decodedPhone.replace(/^\+/, '')}`]

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .in('phone', phoneVariants)
    .single()

  // Deal aberto do contato (mais recente)
  let deal = null
  if (contact?.id) {
    const { data } = await supabase
      .from('deals')
      .select(`
        id, title, status, stage_id, funnel_id,
        pipeline_stages(id, name, color, "order", funnel_id),
        funnels(id, name)
      `)
      .eq('contact_id', contact.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    deal = data
  }

  // Estágios de todos os funis ativos (para o seletor)
  const { data: funnels } = await supabase
    .from('funnels')
    .select(`
      id, name, is_default,
      pipeline_stages(id, name, color, "order")
    `)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  const funnelList = (funnels ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    isDefault: f.is_default,
    stages: (f.pipeline_stages ?? [])
      .sort((a: any, b: any) => a.order - b.order)
      .map((s: any) => ({ id: s.id, name: s.name, color: s.color, order: s.order })),
  }))

  return NextResponse.json({
    contact: contact ? { id: contact.id, name: contact.name, phone: contact.phone } : null,
    deal: deal
      ? {
          id: (deal as any).id,
          title: (deal as any).title,
          status: (deal as any).status,
          stageId: (deal as any).stage_id,
          stageName: (deal as any).pipeline_stages?.name ?? null,
          stageColor: (deal as any).pipeline_stages?.color ?? null,
          funnelId: (deal as any).funnel_id,
          funnelName: (deal as any).funnels?.name ?? null,
        }
      : null,
    funnels: funnelList,
  })
}

// ---------------------------------------------------------------------------
// POST — cria deal ou move para estágio específico
// ---------------------------------------------------------------------------
const postSchema = z.object({
  stageId: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { phone } = await params
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'stageId é obrigatório' }, { status: 400 })
  }

  const decodedPhone = decodeURIComponent(phone)
  const phoneVariants = [decodedPhone, decodedPhone.replace(/^\+/, ''), `+${decodedPhone.replace(/^\+/, '')}`]

  // Busca o estágio para obter o funnel_id
  const { data: stage, error: stageErr } = await supabase
    .from('pipeline_stages')
    .select('id, name, funnel_id')
    .eq('id', parsed.data.stageId)
    .single()

  if (stageErr || !stage) {
    return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
  }

  // Busca ou cria o contato
  let contactId: string | null = null
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name')
    .in('phone', phoneVariants)
    .single()

  if (existingContact) {
    contactId = existingContact.id
  } else {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({ phone: decodedPhone, name: decodedPhone })
      .select('id')
      .single()
    contactId = newContact?.id ?? null
  }

  // Verifica se já existe deal aberto para esse contato
  if (contactId) {
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id, stage_id')
      .eq('contact_id', contactId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingDeal) {
      // Move o deal para o novo estágio
      const now = new Date().toISOString()

      // Fecha o log do estágio anterior
      await supabase
        .from('stage_time_logs')
        .update({ left_at: now })
        .eq('deal_id', existingDeal.id)
        .is('left_at', null)

      // Atualiza o deal
      const { data: updated, error } = await supabase
        .from('deals')
        .update({
          stage_id: parsed.data.stageId,
          funnel_id: stage.funnel_id,
          entered_stage_at: now,
          updated_at: now,
        })
        .eq('id', existingDeal.id)
        .select('id, title, stage_id, funnel_id')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Abre novo log de estágio
      await supabase.from('stage_time_logs').insert({
        deal_id: existingDeal.id,
        stage_id: parsed.data.stageId,
        funnel_id: stage.funnel_id,
        entered_at: now,
      })

      return NextResponse.json({ deal: updated, action: 'moved' })
    }
  }

  // Cria novo deal
  const contactName = existingContact?.name ?? decodedPhone
  const { data: newDeal, error } = await supabase
    .from('deals')
    .insert({
      contact_id: contactId,
      stage_id: parsed.data.stageId,
      funnel_id: stage.funnel_id,
      title: contactName,
      value: 0,
      status: 'open',
      source: 'whatsapp_inbound',
      entered_stage_at: new Date().toISOString(),
    })
    .select('id, title, stage_id, funnel_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log de estágio inicial
  if (newDeal) {
    await supabase.from('stage_time_logs').insert({
      deal_id: newDeal.id,
      stage_id: parsed.data.stageId,
      funnel_id: stage.funnel_id,
      entered_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ deal: newDeal, action: 'created' }, { status: 201 })
}
