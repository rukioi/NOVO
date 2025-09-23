
-- ============================================================================
-- FUNÇÃO PARA EXECUÇÃO DE SQL EM SCHEMAS DE TENANT
-- ============================================================================

-- Função para executar SQL bruto nos schemas de tenant
CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT, query_params JSONB DEFAULT '[]'::JSONB)
RETURNS TABLE(result JSONB) AS $$
DECLARE
    prepared_query TEXT;
    param_count INT;
    i INT;
    param_value TEXT;
BEGIN
    -- Preparar query com parâmetros
    prepared_query := query_text;
    param_count := jsonb_array_length(query_params);
    
    -- Substituir parâmetros $1, $2, etc. pelos valores
    FOR i IN 0..(param_count - 1) LOOP
        param_value := quote_literal(query_params->>i);
        prepared_query := replace(prepared_query, '$' || (i + 1)::TEXT, param_value);
    END LOOP;
    
    -- Executar query dinamicamente
    RETURN QUERY EXECUTE 'SELECT to_jsonb(t) FROM (' || prepared_query || ') t';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error executing SQL: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION execute_sql(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT, JSONB) TO anon;

COMMENT ON FUNCTION execute_sql IS 'Executa SQL dinâmico nos schemas de tenant para operações multi-tenant';
