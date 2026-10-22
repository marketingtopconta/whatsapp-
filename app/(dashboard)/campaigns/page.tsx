import { Suspense } from 'react'
import { getCampaignsInitialData } from './actions'
import { CampaignsClientWrapper } from './CampaignsClientWrapper'
import { CampaignsSkeleton } from '@/components/features/campaigns/CampaignsSkeleton'

// ISR: revalida a cada 60 segundos (campanhas mudam menos que dashboard)
export const revalidate = 60

// Teto para a busca inicial no servidor. Se o Supabase estiver lento, a função
// da Vercel é encerrada no meio do stream e o navegador mostra "Connection closed".
const INITIAL_DATA_TIMEOUT_MS = 8_000

/**
 * Componente async que busca dados no servidor e passa para o cliente.
 * Se a busca falhar ou demorar demais, renderiza sem initialData e o
 * React Query busca no cliente (a página abre em vez de quebrar).
 */
async function CampaignsWithData() {
  let initialData: Awaited<ReturnType<typeof getCampaignsInitialData>> | undefined
  try {
    initialData = await Promise.race([
      getCampaignsInitialData(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), INITIAL_DATA_TIMEOUT_MS)
      ),
    ])
  } catch (error) {
    console.error('[Campaigns] Falha na busca inicial, seguindo sem initialData:', error)
  }
  return <CampaignsClientWrapper initialData={initialData} />
}

/**
 * Campaigns Page - RSC Híbrido
 *
 * Arquitetura:
 * 1. Servidor busca primeira página + folders + tags (com timeout)
 * 2. HTML é enviado com dados já presentes
 * 3. Cliente hidrata com initialData (sem loading spinner)
 * 4. React Query assume e mantém dados atualizados
 */
export default function CampaignsPage() {
  return (
    <Suspense fallback={<CampaignsSkeleton />}>
      <CampaignsWithData />
    </Suspense>
  )
}
