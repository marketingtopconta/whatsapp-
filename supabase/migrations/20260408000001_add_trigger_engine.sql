-- =============================================================================
-- SMARTZAP Evolution v2 — Fase 2: Motor de Triggers e Sequências de Ações
-- =============================================================================

-- ---------------------------------------------------------------------------
-- triggers: regras de automação por funil/estágio
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS triggers (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    funnel_id    TEXT REFERENCES funnels(id) ON DELETE CASCADE,
    stage_id     TEXT REFERENCES pipeline_stages(id) ON DELETE CASCADE,  -- NULL = qualquer estágio
    name         TEXT NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    trigger_type TEXT NOT NULL,
    -- 'time_no_reply'  → sem resposta após X minutos
    -- 'keyword'        → cliente enviou palavra-chave
    -- 'stage_enter'    → lead entrou neste estágio
    -- 'stage_exit'     → lead saiu deste estágio
    -- 'deal_won'       → deal marcado como ganho
    -- 'deal_lost'      → deal marcado como perdido
    -- 'tag_added'      → tag adicionada ao deal
    trigger_config JSONB NOT NULL DEFAULT '{}',
    -- time_no_reply:  { "minutes": 30 }
    -- keyword:        { "keywords": ["preço", "valor"], "match": "any" }
    -- tag_added:      { "tag": "vip" }
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- trigger_actions: ações em sequência por trigger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trigger_actions (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    trigger_id    TEXT NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
    "order"       INTEGER NOT NULL DEFAULT 0,
    action_type   TEXT NOT NULL,
    -- 'send_template'  → envia template WhatsApp
    -- 'send_text'      → envia texto livre
    -- 'move_stage'     → move deal para outro estágio
    -- 'add_tag'        → adiciona tag ao deal
    -- 'assign_to'      → atribui a um atendente
    -- 'wait'           → aguarda X minutos antes da próxima ação
    -- 'mark_won'       → marca como ganho
    -- 'mark_lost'      → marca como perdido
    -- 'webhook'        → chama URL externa (POST)
    action_config JSONB NOT NULL DEFAULT '{}',
    -- send_template: { "template_name": "follow_up_1", "language": "pt_BR" }
    -- send_text:     { "text": "Olá {{name}}, tudo bem?" }
    -- move_stage:    { "stage_id": "uuid" }
    -- add_tag:       { "tag": "interessado" }
    -- assign_to:     { "name": "João" }
    -- wait:          { "minutes": 60 }
    -- webhook:       { "url": "https://...", "method": "POST" }
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- trigger_execution_log: histórico de execuções para auditoria e debug
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trigger_execution_log (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    trigger_id       TEXT REFERENCES triggers(id) ON DELETE SET NULL,
    deal_id          TEXT REFERENCES deals(id) ON DELETE CASCADE,
    trigger_name     TEXT,   -- snapshot do nome no momento da execução
    status           TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'running' | 'success' | 'failed' | 'skipped'
    started_at       TIMESTAMPTZ DEFAULT NOW(),
    finished_at      TIMESTAMPTZ,
    actions_executed INTEGER DEFAULT 0,
    error_message    TEXT,
    metadata         JSONB NOT NULL DEFAULT '{}'
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_triggers_funnel_id  ON triggers(funnel_id);
CREATE INDEX IF NOT EXISTS idx_triggers_stage_id   ON triggers(stage_id);
CREATE INDEX IF NOT EXISTS idx_trigger_actions_trigger_id ON trigger_actions(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_log_deal_id ON trigger_execution_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_trigger_log_status  ON trigger_execution_log(status);
CREATE INDEX IF NOT EXISTS idx_trigger_log_started ON trigger_execution_log(started_at DESC);

-- Trigger updated_at para triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_triggers_updated_at') THEN
        CREATE TRIGGER set_triggers_updated_at
            BEFORE UPDATE ON triggers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;
