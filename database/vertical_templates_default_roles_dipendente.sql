UPDATE vertical_templates
SET default_roles_json = '["ADMIN","SEGRETARIO","DIPENDENTE"]'::jsonb,
    updated_at = NOW()
WHERE key IN ('dental', 'medical', 'physiotherapy', 'aesthetics', 'consulting', 'services');
