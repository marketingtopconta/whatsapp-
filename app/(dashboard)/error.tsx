'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-xl font-semibold text-white">Não foi possível carregar esta página</h2>
      <p className="max-w-md text-sm text-zinc-400">
        O banco de dados demorou a responder. Isso costuma passar em instantes.
      </p>
      <p className="font-mono text-xs text-zinc-600">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
      >
        Tentar novamente
      </button>
    </div>
  )
}
