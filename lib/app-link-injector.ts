/**
 * Injeta tokens de rastreamento nos botões de URL dinâmicos de um template.
 * Chamado logo antes de buildMetaTemplatePayload no workflow de campanha.
 *
 * Se o template tem um botão URL com {{1}} e não há valor definido para ele,
 * gera um token único, persiste na tabela app_link_tokens e injeta como parâmetro.
 */

import { createAppLinkToken } from '@/lib/app-link'

interface ButtonValue {
  index: number
  params: Array<{ key: string; text: string }>
}

interface ResolvedValues {
  buttons?: ButtonValue[]
  [key: string]: any
}

interface TemplateButton {
  type: string
  url?: string
}

function hasUrlVariable(url?: string): boolean {
  return !!url && url.includes('{{')
}

function getDynamicUrlButtonIndices(template: any): number[] {
  const indices: number[] = []
  if (!template?.components) return indices

  const buttonComponents = template.components.filter(
    (c: any) => String(c?.type || '').toUpperCase() === 'BUTTONS'
  )

  let globalIndex = 0
  for (const bc of buttonComponents) {
    for (const btn of (bc.buttons as TemplateButton[]) || []) {
      if (btn.type === 'URL' && hasUrlVariable(btn.url)) {
        indices.push(globalIndex)
      }
      globalIndex++
    }
  }
  return indices
}

export interface TrackingInjectOptions {
  phone: string
  contactId?: string | null
  campaignContactId?: string | null
  dealId?: string | null
  templateName?: string | null
  campaignName?: string | null
  template: any
  values: ResolvedValues
}

export async function injectTrackingTokens(opts: TrackingInjectOptions): Promise<ResolvedValues> {
  const dynamicIndices = getDynamicUrlButtonIndices(opts.template)
  if (dynamicIndices.length === 0) return opts.values

  const existingButtons: ButtonValue[] = opts.values.buttons ? [...opts.values.buttons] : []

  for (const index of dynamicIndices) {
    const existing = existingButtons.find((b) => b.index === index)
    // Só injeta se ainda não houver valor para este botão
    if (existing && existing.params.length > 0) continue

    // Gera o token e persiste
    const token = await createAppLinkToken({
      phone: opts.phone,
      contactId: opts.contactId ?? null,
      campaignContactId: opts.campaignContactId ?? null,
      dealId: opts.dealId ?? null,
      templateName: opts.templateName ?? null,
      campaignName: opts.campaignName ?? null,
    })

    if (!token) continue

    // Remove entrada vazia se existir
    const filtered = existingButtons.filter((b) => b.index !== index)
    filtered.push({
      index,
      params: [{ key: '1', text: token }],
    })
    existingButtons.length = 0
    existingButtons.push(...filtered)
  }

  return { ...opts.values, buttons: existingButtons }
}
