import { settingsDb } from '@/lib/supabase-db'

interface VerifyTokenOptions {
    readonly?: boolean
}

let inMemoryToken: string | null = null

/**
 * Mascara token para logs — exibe apenas os primeiros e últimos 4 caracteres.
 */
function maskToken(token: string): string {
    if (token.length <= 8) return '****'
    return `${token.slice(0, 4)}...${token.slice(-4)}`
}

/**
 * Get or generate webhook verify token
 *
 * @param options.readonly If true, will NOT generate a new token if missing (prevents race conditions)
 */
export async function getVerifyToken(options: VerifyTokenOptions = {}): Promise<string> {
    const { readonly = false } = options

    try {
        // 1. Tenta Supabase settings (fonte primária)
        const storedToken = await settingsDb.get('webhook_verify_token')
        if (storedToken) {
            return storedToken
        }

        // 2. Fallback para variável de ambiente
        if (process.env.WEBHOOK_VERIFY_TOKEN) {
            return process.env.WEBHOOK_VERIFY_TOKEN.trim()
        }

        // 3. Modo read-only: não gera token novo (evita race conditions)
        if (readonly) {
            if (inMemoryToken) {
                return inMemoryToken
            }
            // Fail-closed: sem token configurado, rejeita a requisição.
            throw new Error('Webhook verify token não configurado. Configure WEBHOOK_VERIFY_TOKEN ou execute o setup.')
        }

        // 4. Gera novo token e persiste no banco
        const newToken = crypto.randomUUID()
        inMemoryToken = newToken
        try {
            await settingsDb.set('webhook_verify_token', newToken)
        } catch {
            console.warn(`[verify-token] Falha ao persistir token (${maskToken(newToken)}), usando memória.`)
        }

        // Verifica consistência da escrita
        const check = await settingsDb.get('webhook_verify_token')
        if (check !== newToken) {
            console.error('[verify-token] Falha na verificação de consistência após escrita.')
        }

        return newToken

    } catch (err) {
        console.error('[verify-token] Erro ao obter token:', err instanceof Error ? err.message : err)
        if (inMemoryToken) return inMemoryToken
        const envToken = process.env.WEBHOOK_VERIFY_TOKEN?.trim()
        if (envToken) return envToken
        // Fail-closed: lança erro em vez de retornar token previsível
        throw new Error('Webhook verify token indisponível. Configure META_APP_SECRET e WEBHOOK_VERIFY_TOKEN.')
    }
}
