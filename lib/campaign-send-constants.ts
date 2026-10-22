/**
 * Constantes compartilhadas entre o workflow de disparo (app/api/campaign/workflow)
 * e os endpoints que reenfileiram contatos (ex.: resend-pending).
 *
 * Se um batch morre no meio (timeout de function, deploy, crash, Supabase lento),
 * os contatos já foram marcados 'sending' mas nunca chegam a 'sent'/'failed'/'skipped'.
 * Depois desse teto de tempo, um contato 'sending' é tratado como travado e pode ser
 * reclamado de novo (como se fosse 'pending') por qualquer um dos dois fluxos.
 */
export const STALE_SENDING_MINUTES = 10
