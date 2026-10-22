import { Suspense } from 'react'
import { getDashboardData } from './actions/dashboard'
import { DashboardSkeleton } from '@/components/features/dashboard/DashboardSkeleton'
import { DashboardClientLoader } from './DashboardClientLoader'

// ISR: revalida a cada 30 segundos
export const revalidate = 30

// Teto para a busca inicial no servidor. Se o Supabase estiver lento, a função
// da Vercel é encerrada no meio do stream e o navegador mostra "Connection closed".
const INITIAL_DATA_TIMEOUT_MS = 8_000

/**
 * Componente async que busca dados no servidor e passa para o cliente.
 * O React Query no cliente vai usar esses dados como initialData,
 * evitando loading spinner no primeiro render.
 * Se a busca falhar ou demorar demais, segue sem initialData e o cliente busca depois.
 */
async function DashboardWithData() {
  let initialData: Awaited<ReturnType<typeof getDashboardData>> | undefined
  try {
    initialData = await Promise.race([
      getDashboardData(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), INITIAL_DATA_TIMEOUT_MS)
      ),
    ])
  } catch (error) {
    console.error('[Dashboard] Falha na busca inicial, seguindo sem initialData:', error)
  }
  return <DashboardClientLoader initialData={initialData} />
}

/**
 * Dashboard Page - RSC Híbrido
 *
 * Arquitetura:
 * 1. Servidor busca dados (getDashboardData)
 * 2. HTML é enviado com dados já presentes
 * 3. Cliente hidrata com initialData (sem loading spinner)
 * 4. React Query assume e mantém dados atualizados via Realtime
 *
 * Fallback: DashboardSkeleton é exibido durante streaming
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardWithData />
    </Suspense>
  )
}
