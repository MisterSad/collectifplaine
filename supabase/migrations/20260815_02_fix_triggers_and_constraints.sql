-- ==============================================================================
-- MIGRATION : Correction du Trigger d'Inscription & Intégrité Référentielle
-- Date : 15 Août 2026
-- Description :
--  1. Correction du trigger `handle_new_user()` sur `auth.users`
--  2. Gestion sécurisée des conflits sans tentative de réassignation de PK `id`
--  3. Propagation automatique des métadonnées (entrance, apartment, role)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    default_role text := 'resident';
    extracted_username text;
BEGIN
    -- 1. Récupération du pseudo depuis l'email fake ou les metadata
    extracted_username := COALESCE(
        new.raw_user_meta_data->>'username',
        split_part(new.email, '@', 1)
    );

    -- Si l'utilisateur est Tavares50, lui attribuer le rôle admin
    IF LOWER(extracted_username) = 'tavares50' THEN
        default_role := 'admin';
    END IF;

    -- 2. Insertion sécurisée dans public.residents
    INSERT INTO public.residents (
        id,
        username,
        entrance,
        apartment,
        first_name,
        last_name,
        notifications,
        phone,
        email,
        role
    )
    VALUES (
        new.id,
        extracted_username,
        COALESCE(new.raw_user_meta_data->>'entrance', '38'),
        COALESCE(new.raw_user_meta_data->>'apartment', ''),
        COALESCE(new.raw_user_meta_data->>'first_name', ''),
        COALESCE(new.raw_user_meta_data->>'last_name', ''),
        COALESCE((new.raw_user_meta_data->>'notifications')::boolean, false),
        COALESCE(new.raw_user_meta_data->>'phone', ''),
        COALESCE(new.raw_user_meta_data->>'real_email', ''),
        default_role
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        username = EXCLUDED.username,
        entrance = EXCLUDED.entrance,
        apartment = EXCLUDED.apartment,
        first_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE public.residents.first_name END,
        last_name = CASE WHEN EXCLUDED.last_name <> '' THEN EXCLUDED.last_name ELSE public.residents.last_name END,
        phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE public.residents.phone END,
        email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE public.residents.email END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- S'assurer que le trigger est bien rattaché
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
