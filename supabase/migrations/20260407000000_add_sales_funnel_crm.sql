-- =============================================================================
-- SMARTZAP - CRM de Funil de Vendas
-- Fase 1: Tabelas base (pipeline_stages, deals, deal_activities)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- pipeline_stages: colunas do kanban com config de funil automático por estágio
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name        TEXT NOT NULL,
    "order"     INTEGER NOT NULL DEFAULT 0,
    color       TEXT NOT NULL DEFAULT '#6366f1',
    -- funnel_config: { template_name, delay_hours, action_on_reply: 'move_next'|'stop'|'none' }
    funnel_config JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- deals: oportunidades/leads no funil
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    contact_id          TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    stage_id            TEXT NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    title               TEXT NOT NULL,
    value               NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'won', 'lost')),
    notes               TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    next_action_at      TIMESTAMPTZ,
    qstash_message_id   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    won_at              TIMESTAMPTZ,
    lost_at             TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- deal_activities: histórico de eventos e notas por deal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deal_activities (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    deal_id     TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    -- type: note | call | whatsapp_sent | whatsapp_read | stage_change | system
    type        TEXT NOT NULL DEFAULT 'note',
    body        TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Índices de performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_deals_stage_id     ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id   ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_status       ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_created_at   ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages("order");

-- ---------------------------------------------------------------------------
-- Triggers: atualiza updated_at automaticamente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para pipeline_stages (cria apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_pipeline_stages_updated_at'
    ) THEN
        CREATE TRIGGER set_pipeline_stages_updated_at
            BEFORE UPDATE ON pipeline_stages
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- Trigger para deals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_deals_updated_at'
    ) THEN
        CREATE TRIGGER set_deals_updated_at
            BEFORE UPDATE ON deals
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: métricas de conversão por estágio
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_pipeline_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalDeals',       COUNT(*) FILTER (WHERE status = 'open'),
        'totalValue',       COALESCE(SUM(value) FILTER (WHERE status = 'open'), 0),
        'wonDeals',         COUNT(*) FILTER (WHERE status = 'won'),
        'wonValue',         COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0),
        'lostDeals',        COUNT(*) FILTER (WHERE status = 'lost'),
        'conversionRate',   CASE
                                WHEN COUNT(*) FILTER (WHERE status IN ('won','lost')) > 0
                                THEN ROUND(
                                    COUNT(*) FILTER (WHERE status = 'won')::NUMERIC
                                    / COUNT(*) FILTER (WHERE status IN ('won','lost')) * 100,
                                    1
                                )
                                ELSE 0
                            END
    ) INTO result
    FROM deals;

    RETURN COALESCE(result, '{"totalDeals":0,"totalValue":0,"wonDeals":0,"wonValue":0,"lostDeals":0,"conversionRate":0}'::json);
END;
$$;

-- ---------------------------------------------------------------------------
-- Dados iniciais: 5 estágios padrão do funil
-- Inseridos apenas se a tabela estiver vazia para não duplicar em re-runs
-- ---------------------------------------------------------------------------
INSERT INTO pipeline_stages (id, name, "order", color, funnel_config)
SELECT * FROM (VALUES
    (gen_random_uuid()::TEXT, 'Novo Lead',          0, '#6366f1', '{}'::JSONB),
    (gen_random_uuid()::TEXT, 'Contatado',          1, '#f59e0b', '{}'::JSONB),
    (gen_random_uuid()::TEXT, 'Qualificado',        2, '#3b82f6', '{}'::JSONB),
    (gen_random_uuid()::TEXT, 'Proposta Enviada',   3, '#8b5cf6', '{}'::JSONB),
    (gen_random_uuid()::TEXT, 'Fechado',            4, '#10b981', '{}'::JSONB)
) AS v(id, name, "order", color, funnel_config)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages LIMIT 1);
