import { NextResponse } from 'next/server'
import { Client } from '@upstash/workflow'

import { supabase } from '@/lib/supabase'
import { templateDb, campaignDb } from '@/lib/supabase-db'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { CampaignStatus } from '@/types'

import { precheckContactForTemplate } from '@/lib/whatsapp/template-contract'
import { fetchWithTimeout, safeJson } from '@/lib/server-http'
import { createHash } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Divide um array em pedaços de tamanho fixo para evitar URLs longas no PostgREST
function chunk<T>(array: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError('chunk size must be a positive integer')
  }
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// Limite de concorrência para Promise.all em batches de queries ao PostgREST
const MAX_PARALLEL = 5

function isHttpUrl(value: string): boolean {
  const v = String(value || '').trim()
  return /^https?:\/\//i.test(v)
}

function getTemplateHeaderMediaExampleLink(template: any): { format?: string; example?: string } {
  const components = (template as any)?.components
  if (!Array.isArray(components)) return {}
  const header = components.find((c: any) => String(c?.type || '').toUpperCase() === 'HEADER') as any | undefined
  if (!header) return {}

  const format = header?.format ? String(header.format).toUpperCase() : undefined
  if (!format || !['IMAGE', 'VIDEO', 'DOCUMENT', 'GIF'].includes(format)) return { format }

  let exampleObj: any = header.example
  if (typeof header.example === 'string') {
    try {
      exampleObj = JSON.parse(header.example)
    } catch {
      exampleObj = undefined
    }
  }

  const arr = exampleObj?.header_handle
  const example = Array.isArray(arr) && typeof arr[0] === 'string' ? String(arr[0]).trim() : undefined
  return { format, example }
}

async function fetchSingleTemplateFromMeta(params: {
  businessAccountId: string
  accessToken: string
  templateName: string
}): Promise<
  | {
      name: string
      language?: string
      category?: string
      status?: string
      components?: unknown
      parameter_format?: 'positional' | 'named' | string
      spec_hash?: string | null
      fetched_at?: string | null
    }
  | null
> {
  const { businessAccountId, accessToken, templateName } = params
  const now = new Date().toISOString()

  const url = new URL(`https://graph.facebook.com/v24.0/${businessAccountId}/message_templates`)
  url.searchParams.set('name', templateName)
  url.searchParams.set('fields', 'name,language,category,status,components,parameter_format,last_updated_time')

  const res = await fetchWithTimeout(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeoutMs: 20_000,
  })

  const json = (await safeJson<any>(res)) || {}
  const first = Array.isArray(json?.data) ? json.data[0] : null
  if (!res.ok || !first?.name) return null

  const parameterFormat = (() => {
    const pf = String(first.parameter_format || '').toLowerCase()
    return pf === 'named' ? 'named' : 'positional'
  })()

  const specPayload = {
    name: String(first.name),
    language: String(first.language || 'pt_BR'),
    category: String(first.category || ''),
    parameter_format: parameterFormat,
    components: first.components || [],
  }

  const specHash = createHash('sha256').update(JSON.stringify(specPayload)).digest('hex')

  return {
    name: String(first.name),
    language: String(first.language || 'pt_BR'),
    category: first.category ? String(first.category) : undefined,
    status: first.status ? String(first.status) : undefined,
    components: first.components || [],
    parameter_format: parameterFormat,
    spec_hash: specHash,
    fetched_at: now,
  }
}

interface Params {
  params: Promise<{ id: string }>
}

interface CampaignContactRow {
  id: string
  phone: string
  name: string | null
  email: string | null
  contact_id: string | null
  custom_fields: Record<string, unknown> | null
}

interface ContactRow {
  id: string
  name: string | null
  phone: string
  email: string | null
  custom_fields: Record<string, unknown> | null
}

/**
 * POST /api/campaigns/[id]/resend-pending
 *
 * Reenfileira contatos que nunca chegaram a ser processados (status='pending')
 * numa campanha CANCELADA ou PAUSADA — cenário típico: campanha cancelada no
 * meio do envio (ex.: config de throttle ruim causando timeout de batch) e
 * sobrou gente que nunca foi tentada. Diferente de resend-skipped (que
 * revalida quem foi pulado por precheck), este endpoint pega quem está
 * simplesmente 'pending' e nunca foi disparado.
 *
 * Não reabre campanhas em andamento (SENDING) — nesse caso o próprio workflow
 * já está processando os pending.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id: campaignId } = await params

    const { data: campaignRow, error: campaignError } = await supabase
      .from('campaigns')
      .select('template_name, template_variables, status')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaignRow) {
      return NextResponse.json({ error: 'Falha ao carregar campanha', details: campaignError?.message }, { status: 500 })
    }

    const currentStatus = (campaignRow as any)?.status as string | undefined
    if (currentStatus === CampaignStatus.SENDING) {
      return NextResponse.json(
        { error: 'Campanha ainda está em envio; o workflow atual já está processando os pendentes.', status: currentStatus },
        { status: 409 }
      )
    }

    const templateName = (campaignRow as any)?.template_name as string | null
    if (!templateName) {
      return NextResponse.json({ error: 'Campanha sem template associado' }, { status: 400 })
    }

    let templateVariables: any = (campaignRow as any)?.template_variables
    if (typeof templateVariables === 'string') {
      try {
        templateVariables = JSON.parse(templateVariables)
      } catch {
        templateVariables = undefined
      }
    }

    const initialTemplate = await templateDb.getByName(templateName)
    if (!initialTemplate) {
      return NextResponse.json(
        { error: 'Template não encontrado no banco local. Sincronize Templates antes de reenviar pendentes.' },
        { status: 400 }
      )
    }

    let template = initialTemplate

    const headerInfo0 = getTemplateHeaderMediaExampleLink(template)
    if (headerInfo0.format && ['IMAGE', 'VIDEO', 'DOCUMENT', 'GIF'].includes(headerInfo0.format)) {
      const example0 = headerInfo0.example
      if (!example0 || !isHttpUrl(example0)) {
        try {
          const creds = await getWhatsAppCredentials()
          if (creds?.businessAccountId && creds?.accessToken) {
            const refreshed = await fetchSingleTemplateFromMeta({
              businessAccountId: creds.businessAccountId,
              accessToken: creds.accessToken,
              templateName,
            })
            if (refreshed) {
              await templateDb.upsert([refreshed])
              const refreshedLocal = await templateDb.getByName(templateName)
              if (refreshedLocal) template = refreshedLocal
            }
          }
        } catch (e) {
          console.warn('[ResendPending] Falha ao fazer refresh do template na Meta (best-effort):', e)
        }

        const headerInfo1 = getTemplateHeaderMediaExampleLink(template)
        if (!headerInfo1.example || !isHttpUrl(headerInfo1.example)) {
          return NextResponse.json(
            {
              error:
                `O template "${templateName}" possui HEADER ${headerInfo0.format}, mas o cache local não tem URL de mídia para envio.`,
              action:
                'Sincronize Templates (Meta → local) e tente novamente.',
              details: {
                headerFormat: headerInfo0.format,
                examplePreview: headerInfo1.example || headerInfo0.example || null,
              },
            },
            { status: 400 }
          )
        }
      }
    }

    // 3) Buscar contatos pending
    const { data: pendingRows, error: pendingError } = await supabase
      .from('campaign_contacts')
      .select('id, phone, name, email, contact_id, custom_fields')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    if (pendingError) {
      return NextResponse.json({ error: 'Falha ao buscar pendentes', details: pendingError.message }, { status: 500 })
    }

    const contacts = (pendingRows || []) as CampaignContactRow[]
    if (contacts.length === 0) {
      return NextResponse.json(
        { status: 'nothing', resent: 0, stillSkipped: 0, message: 'Não há contatos pendentes para reenviar.' },
        { status: 200 }
      )
    }

    const contactIds = Array.from(
      new Set(
        contacts
          .map((c) => c.contact_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )

    const contactById = new Map<string, ContactRow>()
    if (contactIds.length > 0) {
      const idChunks = chunk(contactIds, 150)
      const chunkResults = []
      for (let i = 0; i < idChunks.length; i += MAX_PARALLEL) {
        const batch = idChunks.slice(i, i + MAX_PARALLEL)
        chunkResults.push(...(await Promise.all(
          batch.map((ids) =>
            supabase
              .from('contacts')
              .select('id, name, phone, email, custom_fields')
              .in('id', ids)
          )
        )))
      }

      for (const { data, error: latestContactsError } of chunkResults) {
        if (latestContactsError) {
          return NextResponse.json(
            { error: 'Falha ao carregar contatos', details: latestContactsError.message },
            { status: 500 }
          )
        }

        for (const c of (data || []) as any[]) {
          if (!c?.id) continue
          contactById.set(String(c.id), {
            id: String(c.id),
            name: (c.name as string | null) ?? null,
            phone: String(c.phone || ''),
            email: (c.email as string | null) ?? null,
            custom_fields: (c.custom_fields as Record<string, unknown> | null) ?? null,
          })
        }
      }
    }

    const validForResend: Array<{ contactId: string; phone: string; name: string; email?: string; custom_fields?: Record<string, unknown> }> = []
    const updates: Array<any> = []

    for (const row of contacts) {
      const resolvedContactId = row.contact_id
      const latest = resolvedContactId ? contactById.get(resolvedContactId) : undefined
      const effectiveName = (latest?.name ?? row.name ?? '') as string
      const effectivePhone = (latest?.phone ?? row.phone) as string
      const effectiveEmail = (latest?.email ?? row.email) as string | null
      const effectiveCustomFields = (latest?.custom_fields ?? row.custom_fields ?? {}) as Record<string, unknown>

      if (!resolvedContactId) {
        updates.push({
          id: row.id,
          campaign_id: campaignId,
          status: 'skipped',
          phone: effectivePhone,
          name: effectiveName || null,
          email: effectiveEmail,
          custom_fields: effectiveCustomFields,
          failure_reason: 'Contato sem ID (registro antigo ou contato removido). Abra o contato e salve novamente.',
          error: 'Contato sem ID (registro antigo ou contato removido). Abra o contato e salve novamente.',
          message_id: null,
          failed_at: null,
        })
        continue
      }

      const precheck = precheckContactForTemplate(
        {
          phone: effectivePhone,
          name: effectiveName || '',
          email: effectiveEmail || undefined,
          custom_fields: effectiveCustomFields || {},
          contactId: resolvedContactId,
        },
        template as any,
        templateVariables
      )

      if (!precheck.ok) {
        updates.push({
          id: row.id,
          campaign_id: campaignId,
          contact_id: resolvedContactId,
          status: 'skipped',
          phone: precheck.normalizedPhone || effectivePhone,
          name: effectiveName || null,
          email: effectiveEmail,
          custom_fields: effectiveCustomFields,
          failure_reason: precheck.reason,
          error: precheck.reason,
          message_id: null,
          failed_at: null,
        })
        continue
      }

      validForResend.push({
        contactId: resolvedContactId,
        phone: precheck.normalizedPhone,
        name: effectiveName || '',
        email: effectiveEmail || undefined,
        custom_fields: effectiveCustomFields || {},
      })
    }

    const safeUpdates = updates.filter((u) => u && typeof u.id === 'string' && u.id.length > 0)
    if (safeUpdates.length) {
      const { error: upsertError } = await supabase
        .from('campaign_contacts')
        .upsert(safeUpdates, { onConflict: 'id' })

      if (upsertError) {
        return NextResponse.json({ error: 'Falha ao atualizar status dos contatos', details: upsertError.message }, { status: 500 })
      }
    }

    const stillSkipped = safeUpdates.length

    if (validForResend.length === 0) {
      return NextResponse.json(
        {
          status: 'skipped',
          resent: 0,
          stillSkipped,
          message: 'Nenhum contato pendente passou na revalidação.',
        },
        { status: 202 }
      )
    }

    const credentials = await getWhatsAppCredentials()
    if (!credentials?.phoneNumberId || !credentials?.accessToken) {
      return NextResponse.json(
        { error: 'Credenciais WhatsApp não configuradas. Configure em Configurações.' },
        { status: 401 }
      )
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim())
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : null)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : null)
      || 'http://localhost:3000'

    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

    const traceId = `resend_pending_${campaignId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

    // Marca a campanha como SENDING de novo (era CANCELLED/PAUSED) para o workflow assumir.
    await campaignDb.updateStatus(campaignId, {
      status: CampaignStatus.SENDING,
      startedAt: new Date().toISOString(),
      completedAt: null,
      cancelledAt: null,
    })

    const workflowPayload = {
      campaignId,
      traceId,
      templateName,
      contacts: validForResend,
      templateVariables,
      templateSnapshot: {
        name: template.name,
        language: template.language,
        parameter_format: (template as any).parameterFormat || 'positional',
        spec_hash: (template as any).specHash ?? null,
        fetched_at: (template as any).fetchedAt ?? null,
        components: (template as any).components || (template as any).content || [],
      },
      phoneNumberId: credentials.phoneNumberId,
      accessToken: credentials.accessToken,
      isResend: true,
      // Sem throttleConfig aqui de propósito: o workflow busca a config atual
      // do banco (getAdaptiveThrottleConfigWithSource), pegando o valor já
      // corrigido no momento deste disparo em vez de uma foto antiga.
    }

    if (isLocalhost) {
      const response = await fetchWithTimeout(`${baseUrl}/api/campaign/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowPayload),
        timeoutMs: 30000,
      })

      if (!response.ok) {
        const errorData = (await safeJson<any>(response)) || {}
        throw new Error(errorData.error || `Workflow failed with status ${response.status}`)
      }
    } else {
      if (!process.env.QSTASH_TOKEN) {
        return NextResponse.json(
          { error: 'Serviço de workflow não configurado. Configure QSTASH_TOKEN.' },
          { status: 503 }
        )
      }

      const workflowClient = new Client({ token: process.env.QSTASH_TOKEN })
      await workflowClient.trigger({
        url: `${baseUrl}/api/campaign/workflow`,
        body: workflowPayload,
        retries: 3,
      })
    }

    return NextResponse.json(
      {
        status: 'queued',
        resent: validForResend.length,
        stillSkipped,
        traceId,
        message: `${validForResend.length} contatos reenfileirados • ${stillSkipped} pulados na revalidação`,
      },
      { status: 202 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[ResendPending] Error:', error)
    return NextResponse.json(
      { error: 'Falha ao reenviar pendentes', details: errorMessage },
      { status: 500 }
    )
  }
}
