-- =============================================================================
-- Fase 3 — Analytics CRM
-- RPCs para métricas de conversão, timeline de leads, performance de atendentes
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Resumo geral do funil
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_crm_summary(
    p_funnel_id TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_deals',          COUNT(*),
        'open_deals',           COUNT(*) FILTER (WHERE status = 'open'),
        'won_deals',            COUNT(*) FILTER (WHERE status = 'won'),
        'lost_deals',           COUNT(*) FILTER (WHERE status = 'lost'),
        'total_value_open',     COALESCE(SUM(value) FILTER (WHERE status = 'open'), 0),
        'total_value_won',      COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0),
        'avg_deal_value',       COALESCE(AVG(value) FILTER (WHERE status = 'open'), 0),
        'conversion_rate',      CASE
                                    WHEN COUNT(*) FILTER (WHERE status IN ('won','lost')) > 0
                                    THEN ROUND(
                                        COUNT(*) FILTER (WHERE status = 'won')::NUMERIC /
                                        COUNT(*) FILTER (WHERE status IN ('won','lost')) * 100, 1
                                    )
                                    ELSE 0
                                END,
        'new_leads_period',     COUNT(*) FILTER (WHERE created_at BETWEEN p_start_date AND p_end_date)
    )
    INTO v_result
    FROM deals
    WHERE (p_funnel_id IS NULL OR funnel_id = p_funnel_id);

    RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Taxa de conversão por estágio
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_funnel_conversion_rates(
    p_funnel_id TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
    stage_id    TEXT,
    stage_name  TEXT,
    stage_order INT,
    stage_color TEXT,
    total_deals BIGINT,
    won_from_stage BIGINT,
    lost_from_stage BIGINT,
    conversion_rate NUMERIC,
    avg_time_seconds NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.id::TEXT                                                                   AS stage_id,
        ps.name                                                                       AS stage_name,
        ps."order"                                                                    AS stage_order,
        ps.color                                                                      AS stage_color,
        COUNT(DISTINCT d.id)                                                          AS total_deals,
        COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'won')                         AS won_from_stage,
        COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'lost')                        AS lost_from_stage,
        CASE
            WHEN COUNT(DISTINCT d.id) FILTER (WHERE d.status IN ('won','lost')) > 0
            THEN ROUND(
                COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'won')::NUMERIC /
                COUNT(DISTINCT d.id) FILTER (WHERE d.status IN ('won','lost')) * 100, 1
            )
            ELSE 0
        END                                                                           AS conversion_rate,
        COALESCE(AVG(stl.duration_seconds), 0)                                        AS avg_time_seconds
    FROM pipeline_stages ps
    LEFT JOIN deals d
        ON d.stage_id = ps.id
        AND (p_funnel_id IS NULL OR d.funnel_id = p_funnel_id)
        AND d.created_at BETWEEN p_start_date AND p_end_date
    LEFT JOIN stage_time_logs stl
        ON stl.stage_id = ps.id
        AND stl.left_at IS NOT NULL
    WHERE (p_funnel_id IS NULL OR ps.funnel_id = p_funnel_id)
    GROUP BY ps.id, ps.name, ps."order", ps.color
    ORDER BY ps."order";
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Timeline de leads criados (agrupado por dia)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_leads_timeline(
    p_funnel_id TEXT DEFAULT NULL,
    p_days      INT DEFAULT 30
)
RETURNS TABLE(
    day         DATE,
    new_leads   BIGINT,
    won_deals   BIGINT,
    lost_deals  BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH dates AS (
        SELECT generate_series(
            (NOW() - (p_days || ' days')::INTERVAL)::DATE,
            NOW()::DATE,
            '1 day'::INTERVAL
        )::DATE AS day
    )
    SELECT
        d.day,
        COUNT(deals.id) FILTER (WHERE deals.created_at::DATE = d.day)                          AS new_leads,
        COUNT(deals.id) FILTER (WHERE deals.won_at::DATE = d.day AND deals.status = 'won')     AS won_deals,
        COUNT(deals.id) FILTER (WHERE deals.lost_at::DATE = d.day AND deals.status = 'lost')   AS lost_deals
    FROM dates d
    LEFT JOIN deals ON (p_funnel_id IS NULL OR deals.funnel_id = p_funnel_id)
    GROUP BY d.day
    ORDER BY d.day;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Performance por atendente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_attendant_performance(
    p_funnel_id  TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
    attendant       TEXT,
    total_deals     BIGINT,
    open_deals      BIGINT,
    won_deals       BIGINT,
    lost_deals      BIGINT,
    total_value     NUMERIC,
    won_value       NUMERIC,
    conversion_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(d.assigned_to, '(sem atendente)')          AS attendant,
        COUNT(*)                                             AS total_deals,
        COUNT(*) FILTER (WHERE d.status = 'open')           AS open_deals,
        COUNT(*) FILTER (WHERE d.status = 'won')            AS won_deals,
        COUNT(*) FILTER (WHERE d.status = 'lost')           AS lost_deals,
        COALESCE(SUM(d.value), 0)                           AS total_value,
        COALESCE(SUM(d.value) FILTER (WHERE d.status = 'won'), 0) AS won_value,
        CASE
            WHEN COUNT(*) FILTER (WHERE d.status IN ('won','lost')) > 0
            THEN ROUND(
                COUNT(*) FILTER (WHERE d.status = 'won')::NUMERIC /
                COUNT(*) FILTER (WHERE d.status IN ('won','lost')) * 100, 1
            )
            ELSE 0
        END                                                  AS conversion_rate
    FROM deals d
    WHERE (p_funnel_id IS NULL OR d.funnel_id = p_funnel_id)
      AND d.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY d.assigned_to
    ORDER BY won_deals DESC, total_deals DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Fonte de leads (source breakdown)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_leads_by_source(
    p_funnel_id  TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
    source      TEXT,
    total       BIGINT,
    won         BIGINT,
    percentage  NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(d.source, 'manual')                        AS source,
        COUNT(*)                                             AS total,
        COUNT(*) FILTER (WHERE d.status = 'won')            AS won,
        ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 1) AS percentage
    FROM deals d
    WHERE (p_funnel_id IS NULL OR d.funnel_id = p_funnel_id)
      AND d.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY d.source
    ORDER BY total DESC;
END;
$$;

COMMENT ON FUNCTION get_crm_summary IS 'Retorna resumo geral de deals: totais, valores e taxa de conversão';
COMMENT ON FUNCTION get_funnel_conversion_rates IS 'Retorna taxa de conversão e tempo médio por estágio do funil';
COMMENT ON FUNCTION get_leads_timeline IS 'Retorna série temporal de leads criados/ganhos/perdidos por dia';
COMMENT ON FUNCTION get_attendant_performance IS 'Retorna métricas de performance agrupadas por atendente';
COMMENT ON FUNCTION get_leads_by_source IS 'Retorna distribuição de leads por fonte de origem';
