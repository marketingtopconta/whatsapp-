-- =============================================================================
-- SMARTZAP Evolution v2 — Fase 1: Múltiplos Funis + Auto-criação de Lead
-- =============================================================================

-- ---------------------------------------------------------------------------
-- funnels: funis independentes (vendas, pós-venda, reativação, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funnels (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name        TEXT NOT NULL,
    description TEXT,
    is_default  BOOLEAN NOT NULL DEFAULT false,  -- funil que recebe leads automáticos
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garante que só um funil pode ser padrão
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnels_single_default
    ON funnels (is_default)
    WHERE is_default = true;

-- ---------------------------------------------------------------------------
-- Altera pipeline_stages para pertencer a um funil
-- ---------------------------------------------------------------------------
ALTER TABLE pipeline_stages
    ADD COLUMN IF NOT EXISTS funnel_id      TEXT REFERENCES funnels(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS is_entry_stage BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_won_stage   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_lost_stage  BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Altera deals para rastrear funil, atendente e origem
-- ---------------------------------------------------------------------------
ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS funnel_id       TEXT REFERENCES funnels(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_to     TEXT,
    ADD COLUMN IF NOT EXISTS entered_stage_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS source          TEXT NOT NULL DEFAULT 'manual';
    -- source: 'manual' | 'whatsapp_inbound'

-- ---------------------------------------------------------------------------
-- stage_time_logs: rastreia quanto tempo cada lead ficou em cada estágio
-- (usado para calcular tempo médio por estágio)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage_time_logs (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    deal_id          TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    stage_id         TEXT NOT NULL REFERENCES pipeline_stages(id),
    funnel_id        TEXT NOT NULL REFERENCES funnels(id),
    entered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at          TIMESTAMPTZ,           -- NULL = ainda neste estágio
    duration_seconds INTEGER                -- preenchido quando left_at é setado
);

CREATE INDEX IF NOT EXISTS idx_stage_time_logs_deal_id   ON stage_time_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_stage_time_logs_stage_id  ON stage_time_logs(stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_time_logs_funnel_id ON stage_time_logs(funnel_id);
CREATE INDEX IF NOT EXISTS idx_deals_funnel_id           ON deals(funnel_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_funnel_id ON pipeline_stages(funnel_id);

-- ---------------------------------------------------------------------------
-- Trigger updated_at para funnels
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_funnels_updated_at'
    ) THEN
        CREATE TRIGGER set_funnels_updated_at
            BEFORE UPDATE ON funnels
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Funil padrão inicial: migra os estágios existentes para ele
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_funnel_id TEXT;
BEGIN
    -- Só executa se não houver funis ainda
    IF NOT EXISTS (SELECT 1 FROM funnels LIMIT 1) THEN
        v_funnel_id := gen_random_uuid()::TEXT;

        INSERT INTO funnels (id, name, description, is_default, is_active)
        VALUES (
            v_funnel_id,
            'Funil de Vendas',
            'Funil principal criado automaticamente',
            true,
            true
        );

        -- Associa todos os estágios existentes a este funil
        UPDATE pipeline_stages
        SET funnel_id = v_funnel_id
        WHERE funnel_id IS NULL;

        -- Marca o primeiro estágio como entrada e o último como saída
        UPDATE pipeline_stages
        SET is_entry_stage = true
        WHERE funnel_id = v_funnel_id
          AND "order" = (SELECT MIN("order") FROM pipeline_stages WHERE funnel_id = v_funnel_id);

        UPDATE pipeline_stages
        SET is_won_stage = true
        WHERE funnel_id = v_funnel_id
          AND "order" = (SELECT MAX("order") FROM pipeline_stages WHERE funnel_id = v_funnel_id);

        -- Associa todos os deals existentes a este funil
        UPDATE deals SET funnel_id = v_funnel_id WHERE funnel_id IS NULL;

    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: tempo médio por estágio
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_avg_time_per_stage(p_funnel_id TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result JSON;
BEGIN
    SELECT json_agg(row_data ORDER BY row_data->>'stage_order')
    INTO result
    FROM (
        SELECT json_build_object(
            'stage_id',       ps.id,
            'stage_name',     ps.name,
            'stage_order',    ps."order",
            'stage_color',    ps.color,
            'avg_seconds',    COALESCE(AVG(stl.duration_seconds) FILTER (WHERE stl.duration_seconds IS NOT NULL), 0),
            'sample_count',   COUNT(stl.id) FILTER (WHERE stl.duration_seconds IS NOT NULL)
        ) AS row_data
        FROM pipeline_stages ps
        LEFT JOIN stage_time_logs stl ON stl.stage_id = ps.id
        WHERE (p_funnel_id IS NULL OR ps.funnel_id = p_funnel_id)
        GROUP BY ps.id, ps.name, ps."order", ps.color
    ) sub;

    RETURN COALESCE(result, '[]'::json);
END;
$$;
