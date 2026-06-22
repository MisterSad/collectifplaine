-- Migration: Migrate to Supabase Auth & Enable Row Level Security (RLS)
-- Target: Supabase Database

-- 1. Vider la table 'residents' pour éviter les violations de clé étrangère
-- (Les résidents devront recréer leur compte via l'inscription Supabase Auth)
TRUNCATE TABLE residents CASCADE;

-- 2. Nettoyer et adapter la table 'residents'
ALTER TABLE residents DROP COLUMN IF EXISTS password_hash;

-- Convertir la colonne id en UUID
ALTER TABLE residents ALTER COLUMN id TYPE uuid USING (gen_random_uuid());

-- Ajouter la contrainte de clé étrangère vers auth.users
ALTER TABLE residents DROP CONSTRAINT IF EXISTS fk_residents_auth_users;
ALTER TABLE residents ADD CONSTRAINT fk_residents_auth_users FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ajouter une contrainte d'unicité sur le pseudo (username)
ALTER TABLE residents DROP CONSTRAINT IF EXISTS uq_residents_username;
ALTER TABLE residents ADD CONSTRAINT uq_residents_username UNIQUE (username);

-- 3. Créer le trigger de création de profil automatique lors de l'inscription via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.residents (id, username, entrance, apartment, first_name, last_name, notifications, phone, email)
  VALUES (
    new.id,
    split_part(new.email, '@', 1), -- Récupère le pseudo depuis l'email factice (ex: Sarah48 de Sarah48@collectifplaine.local)
    COALESCE(new.raw_user_meta_data->>'entrance', '38'),
    COALESCE(new.raw_user_meta_data->>'apartment', ''),
    '',
    '',
    false,
    '',
    ''
  )
  ON CONFLICT (username) DO UPDATE
  SET id = new.id; -- Gère la transition si le pseudo existait déjà
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Activer le Row Level Security (RLS) sur toutes les tables
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevators ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

-- 5. Définir les politiques de sécurité (Policies)

-- POLITIQUES : residents
DROP POLICY IF EXISTS "Allow public select on profiles" ON residents;
CREATE POLICY "Allow public select on profiles" ON residents
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON residents;
CREATE POLICY "Allow users to update their own profile" ON residents
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- POLITIQUES : elevators
DROP POLICY IF EXISTS "Allow public select on elevators" ON elevators;
CREATE POLICY "Allow public select on elevators" ON elevators
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated to update elevators" ON elevators;
CREATE POLICY "Allow authenticated to update elevators" ON elevators
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to insert elevators" ON elevators;
CREATE POLICY "Allow authenticated to insert elevators" ON elevators
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- POLITIQUES : reports
DROP POLICY IF EXISTS "Allow public select on reports" ON reports;
CREATE POLICY "Allow public select on reports" ON reports
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert reports" ON reports;
CREATE POLICY "Allow authenticated to insert reports" ON reports
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to delete reports" ON reports;
CREATE POLICY "Allow authenticated to delete reports" ON reports
    FOR DELETE TO authenticated
    USING (true);

-- POLITIQUES : histories
DROP POLICY IF EXISTS "Allow public select on histories" ON histories;
CREATE POLICY "Allow public select on histories" ON histories
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert histories" ON histories;
CREATE POLICY "Allow authenticated to insert histories" ON histories
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- POLITIQUES : incidents
DROP POLICY IF EXISTS "Allow public select on incidents" ON incidents;
CREATE POLICY "Allow public select on incidents" ON incidents
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert incidents" ON incidents;
CREATE POLICY "Allow authenticated to insert incidents" ON incidents
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to modify incidents" ON incidents;
CREATE POLICY "Allow authenticated to modify incidents" ON incidents
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- POLITIQUES : community_messages
DROP POLICY IF EXISTS "Allow public select on community_messages" ON community_messages;
CREATE POLICY "Allow public select on community_messages" ON community_messages
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert community_messages" ON community_messages;
CREATE POLICY "Allow authenticated to insert community_messages" ON community_messages
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to modify community_messages" ON community_messages;
CREATE POLICY "Allow authenticated to modify community_messages" ON community_messages
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Créer une fonction RPC pour permettre à l'utilisateur connecté de supprimer son compte
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
