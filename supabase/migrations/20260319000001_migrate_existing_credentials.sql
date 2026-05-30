DO $$
DECLARE
    source_rec RECORD;
    credential_key TEXT;
    credential_val TEXT;
    new_config JSONB;
BEGIN
    FOR source_rec IN SELECT id, source_type, source_config FROM public.pack_sources WHERE source_config IS NOT NULL LOOP
        credential_key := NULL;
        credential_val := NULL;
        new_config := source_rec.source_config;

        -- Identify credential key based on source_type
        CASE source_rec.source_type
            WHEN 'github_repo' THEN credential_key := 'github_token';
            WHEN 'confluence' THEN credential_key := 'api_token';
            WHEN 'notion' THEN credential_key := 'integration_token';
            WHEN 'slack_channel' THEN credential_key := 'bot_token';
            WHEN 'jira' THEN credential_key := 'api_token';
            WHEN 'linear' THEN credential_key := 'api_key';
            WHEN 'google_drive' THEN credential_key := 'service_account_key';
            WHEN 'figma' THEN credential_key := 'personal_access_token';
            WHEN 'pagerduty' THEN credential_key := 'api_key';
            WHEN 'sharepoint' THEN credential_key := 'client_secret';
            WHEN 'postman_collection' THEN credential_key := 'postman_api_key';
            WHEN 'loom_video' THEN credential_key := 'api_key';
            ELSE credential_key := NULL;
        END CASE;

        -- If credential found in config, move it to Vault
        IF credential_key IS NOT NULL AND source_rec.source_config ? credential_key THEN
            credential_val := source_rec.source_config->>credential_key;
            
            -- Store in Vault using the SECURITY DEFINER function
            PERFORM public.store_source_credential(source_rec.id, credential_key, credential_val);
            
            -- Remove from config
            new_config := new_config - credential_key;
            
            UPDATE public.pack_sources 
            SET source_config = new_config 
            WHERE id = source_rec.id;
            
            RAISE NOTICE 'Migrated % for source % (%)', credential_key, source_rec.id, source_rec.source_type;
        END IF;
    END LOOP;
END $$;
