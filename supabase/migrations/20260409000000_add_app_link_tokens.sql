-- =============================================================================
-- App Link Tokens — rastreamento de cliques no link do app
-- Cada envio de template com link gera um token único por contato/deal
-- O AppsFlyer envia postbacks para fechar o funil (install, account, purchase)
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_link_tokens (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    token               TEXT UNIQUE NOT NULL,

    -- Origem
    deal_id             TEXT REFERENCES deals(id) ON DELETE SET NULL,
    contact_id          TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    campaign_contact_id TEXT REFERENCES campaign_contacts(id) ON DELETE SET NULL,
    phone               TEXT,

    -- Contexto de envio
    template_name       TEXT,
    campaign_name       TEXT,

    -- Funil de conversão (preenchidos progressivamente)
    clicked_at          TIMESTAMPTZ,          -- clicou no link
    click_count         INTEGER NOT NULL DEFAULT 0,
    store_reached_at    TIMESTAMPTZ,          -- chegou na loja (=clicked, por ora)
    installed_at        TIMESTAMPTZ,          -- baixou o app (AppsFlyer postback)
    account_opened_at   TIMESTAMPTZ,          -- abriu conta (AppsFlyer postback)
    first_purchase_at   TIMESTAMPTZ,          -- primeira compra (AppsFlyer postback)

    -- AppsFlyer attribution data (recebido via postback)
    af_install_id       TEXT,
    af_campaign         TEXT,
    af_adset            TEXT,
    af_ad               TEXT,
    af_media_source     TEXT,
    af_raw              JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_link_tokens_token      ON app_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_app_link_tokens_deal_id    ON app_link_tokens(deal_id);
CREATE INDEX IF NOT EXISTS idx_app_link_tokens_contact_id ON app_link_tokens(contact_id);
CREATE INDEX IF NOT EXISTS idx_app_link_tokens_phone      ON app_link_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_app_link_tokens_clicked    ON app_link_tokens(clicked_at) WHERE clicked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_link_tokens_installed  ON app_link_tokens(installed_at) WHERE installed_at IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_app_link_tokens_updated_at') THEN
        CREATE TRIGGER set_app_link_tokens_updated_at
            BEFORE UPDATE ON app_link_tokens
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- RPC: funil de conversão agregado
CREATE OR REPLACE FUNCTION get_app_link_funnel(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date   TIMESTAMPTZ DEFAULT NOW(),
    p_campaign   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'sent',             COUNT(*),
        'clicked',          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL),
        'installed',        COUNT(*) FILTER (WHERE installed_at IS NOT NULL),
        'account_opened',   COUNT(*) FILTER (WHERE account_opened_at IS NOT NULL),
        'first_purchase',   COUNT(*) FILTER (WHERE first_purchase_at IS NOT NULL),
        'click_rate',       CASE WHEN COUNT(*) > 0 THEN
                                ROUND(COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::NUMERIC / COUNT(*) * 100, 1)
                            ELSE 0 END,
        'install_rate',     CASE WHEN COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) > 0 THEN
                                ROUND(COUNT(*) FILTER (WHERE installed_at IS NOT NULL)::NUMERIC /
                                      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) * 100, 1)
                            ELSE 0 END,
        'conversion_rate',  CASE WHEN COUNT(*) > 0 THEN
                                ROUND(COUNT(*) FILTER (WHERE account_opened_at IS NOT NULL)::NUMERIC / COUNT(*) * 100, 1)
                            ELSE 0 END
    )
    INTO v_result
    FROM app_link_tokens
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND (p_campaign IS NULL OR campaign_name = p_campaign);
    RETURN v_result;
END;
$$;

COMMENT ON TABLE app_link_tokens IS 'Tokens únicos por envio para rastrear cliques e conversões via AppsFlyer';
COMMENT ON FUNCTION get_app_link_funnel IS 'Funil de conversão: enviados → clicaram → instalaram → abriram conta → compraram';
