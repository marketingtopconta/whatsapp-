import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateConversation, listMessages, sendMessage } from '@/lib/inbox/inbox-service'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// GET — busca a conversa do WhatsApp vinculada ao contato do deal
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  // Busca o deal com seu contato
  const { data: deal, error } = await supabase
    .from('deals')
    .select('id, contact_id, contacts(id, name, phone)')
    .eq('id', id)
    .single()

  if (error || !deal) return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })

  const phone = (deal as any)?.contacts?.phone ?? null
  if (!phone) {
    return NextResponse.json({ conversationId: null, messages: [], noPhone: true })
  }

  // Localiza ou cria a conversa inbox para esse telefone
  const conversation = await findOrCreateConversation(phone, (deal as any)?.contacts?.id)

  const { searchParams } = request.nextUrl
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  const result = await listMessages(conversation.id, { limit })

  return NextResponse.json({
    conversationId: conversation.id,
    phone,
    contactName: (deal as any)?.contacts?.name ?? null,
    messages: result.messages,
    hasMore: result.hasMore,
  })
}

// ---------------------------------------------------------------------------
// POST — envia mensagem de texto pelo WhatsApp
// ---------------------------------------------------------------------------
const postSchema = z.object({
  content: z.string().min(1).max(4096),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'DB indisponível' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Conteúdo inválido' }, { status: 400 })
  }

  // Busca o deal com seu contato
  const { data: deal, error } = await supabase
    .from('deals')
    .select('id, contact_id, contacts(id, name, phone)')
    .eq('id', id)
    .single()

  if (error || !deal) return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })

  const phone = (deal as any)?.contacts?.phone ?? null
  if (!phone) return NextResponse.json({ error: 'Deal sem telefone de contato' }, { status: 422 })

  const conversation = await findOrCreateConversation(phone, (deal as any)?.contacts?.id)
  const message = await sendMessage(conversation.id, parsed.data.content, 'text')

  return NextResponse.json({ message }, { status: 201 })
}
