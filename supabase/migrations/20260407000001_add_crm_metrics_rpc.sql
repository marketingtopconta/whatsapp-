-- =============================================================================
-- SMARTZAP - CRM Fase 4: RPC de métricas por estágio
-- =============================================================================

/**
 * get_pipeline_stage_metrics()
 *
 * Retorna métricas agregadas por estágio do pipeline:
 * - count de deals abertos, ganhos, perdidos
 * - soma de valor em aberto e total ganho
 *
 * Usado pelo widget do dashboard e pela tela de Funil CRM.
 */
CREATE OR REPLACE FUNCTION get_pipeline_stage_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(row_data ORDER BY row_data->>'stage_order')
    INTO result
    FROM (
        SELECT json_build_object(
            'stage_id',     ps.id,
            'stage_name',   ps.name,
            'stage_order',  ps."order",
            'stage_color',  ps.color,
            'open_count',   COUNT(d.id) FILTER (WHERE d.status = 'open'),
            'won_count',    COUNT(d.id) FILTER (WHERE d.status = 'won'),
            'lost_count',   COUNT(d.id) FILTER (WHERE d.status = 'lost'),
            'open_value',   COALESCE(SUM(d.value) FILTER (WHERE d.status = 'open'), 0),
            'won_value',    COALESCE(SUM(d.value) FILTER (WHERE d.status = 'won'), 0)
        ) AS row_data
        FROM pipeline_stages ps
        LEFT JOIN deals d ON d.stage_id = ps.id
        GROUP BY ps.id, ps.name, ps."order", ps.color
    ) sub;

    RETURN COALESCE(result, '[]'::json);
END;
$$;
