import { NextRequest, NextResponse } from 'next/server'
import { processLinkClick } from '@/lib/app-link'

/**
 * GET /api/r/[token]
 * Endpoint público de redirecionamento rastreável.
 * Registra o clique e redireciona para o OneLink da ToiConta.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 4) {
    // Token inválido → redireciona direto para o app sem tracking
    return NextResponse.redirect('https://topconta.onelink.me/tLP0/ggu32wi3', { status: 302 })
  }

  const destinationUrl = await processLinkClick(token)
  const target = destinationUrl ?? 'https://topconta.onelink.me/tLP0/ggu32wi3'

  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      // Impede cache do redirect — cada acesso deve ser registrado
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
