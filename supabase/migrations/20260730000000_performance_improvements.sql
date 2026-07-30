-- Performance improvements: Inbox e Dashboard
--
-- 1. Função agregada get_campaign_daily_stats: move a agregação diária de 30 dias
--    do client (JavaScript) para o banco, eliminando o download de TODAS as
--    campanhas (com colunas pesadas como template_snapshot) a cada carregamento
--    do dashboard.
-- 2. Índices trigram (pg_trgm) para busca por ILIKE em inbox_conversations.phone
--    e contacts.name, evitando sequential scan a cada busca no Inbox.
-- 3. Índice dedicado para filtro por status isolado (sem mode) no Inbox.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 1. Agregação diária de campanhas (últimos N dias) calculada no Postgres
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_campaign_daily_stats(p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  sent integer,
  delivered integer,
  read integer,
  failed integer,
  active integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH days AS (
    SELECT generate_series(
      (CURRENT_DATE - (GREATEST(p_days, 1) - 1)),
      CURRENT_DATE,
      interval '1 day'
    )::date AS day
  ),
  campaign_days AS (
    SELECT
      COALESCE(last_sent_at, started_at, created_at)::date AS day,
      sent,
      delivered,
      read,
      failed,
      lower(status) AS status
    FROM public.campaigns
    WHERE COALESCE(last_sent_at, started_at, created_at) >= (CURRENT_DATE - (GREATEST(p_days, 1) - 1))
  )
  SELECT
    d.day,
    COALESCE(SUM(c.sent), 0)::integer AS sent,
    COALESCE(SUM(c.delivered), 0)::integer AS delivered,
    COALESCE(SUM(c.read), 0)::integer AS read,
    COALESCE(SUM(c.failed), 0)::integer AS failed,
    COUNT(*) FILTER (WHERE c.status IN ('enviando', 'sending', 'agendado', 'scheduled'))::integer AS active
  FROM days d
  LEFT JOIN campaign_days c ON c.day = d.day
  GROUP BY d.day
  ORDER BY d.day;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_daily_stats(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_daily_stats(integer) TO service_role;

-- =============================================================================
-- 2. Índices trigram para busca (Inbox)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_inbox_conversations_phone_trgm
  ON public.inbox_conversations USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin (name gin_trgm_ops);

-- =============================================================================
-- 3. Índice para filtro por status isolado (sem mode) no Inbox
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status_last_message
  ON public.inbox_conversations USING btree (status, last_message_at DESC NULLS LAST);
