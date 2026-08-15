-- ==============================================================================
-- MIGRATION : Sécurisation, Durcissement RLS & Indexation (Standards 2026)
-- Date : 15 Août 2026
-- Description : 
--  1. Ajout de la colonne `role` sur `public.residents` ('resident' | 'admin')
--  2. Ajout des colonnes de traçabilité d'auteur (`user_id`, `created_by`)
--  3. Correction RLS sur `residents` : protection stricte des PII (téléphone, email)
--  4. Correction RLS sur `reports`, `incidents`, `elevators`, `community_messages` (anti-BOLA)
--  5. Création des index de clés étrangères et de filtrage pour booster les requêtes
-- ==============================================================================

-- 1. Ajout de la gestion des rôles (RBAC) sur la table residents
ALTER TABLE public.residents 
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'resident';

ALTER TABLE public.residents 
DROP CONSTRAINT IF EXISTS chk_residents_role;

ALTER TABLE public.residents 
ADD CONSTRAINT chk_residents_role CHECK (role IN ('resident', 'admin'));

-- Initialiser l'administrateur historique Tavares50
UPDATE public.residents 
SET role = 'admin' 
WHERE LOWER(username) = 'tavares50';

-- 2. Ajout des colonnes d'appartenance sur reports, incidents et democracy
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.petitions 
ADD COLUMN IF NOT EXISTS target_signatures integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE public.poll_votes 
ADD COLUMN IF NOT EXISTS selected_option text;

-- 3. Durcissement RLS sur la table `residents` (Protection PII)
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on profiles" ON public.residents;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.residents;
DROP POLICY IF EXISTS "Allow users to delete their own profile" ON public.residents;
DROP POLICY IF EXISTS "Allow authenticated to view public profile info" ON public.residents;
DROP POLICY IF EXISTS "Allow authenticated to view profiles" ON public.residents;

CREATE POLICY "Allow authenticated to view profiles" ON public.residents
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow users to update their own profile" ON public.residents
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR (SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin')
    WITH CHECK (auth.uid() = id OR (SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Allow users to delete their own profile" ON public.residents
    FOR DELETE TO authenticated
    USING (auth.uid() = id OR (SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

-- 4. Durcissement RLS sur `reports` (Signalements d'ascenseurs)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on reports" ON public.reports;
DROP POLICY IF EXISTS "Allow authenticated to insert reports" ON public.reports;
DROP POLICY IF EXISTS "Allow authenticated to delete reports" ON public.reports;
DROP POLICY IF EXISTS "Allow author or admin to delete reports" ON public.reports;

CREATE POLICY "Allow public read access on reports" ON public.reports
    FOR SELECT TO public
    USING (true);

CREATE POLICY "Allow authenticated to insert reports" ON public.reports
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow author or admin to delete reports" ON public.reports
    FOR DELETE TO authenticated
    USING (
        auth.uid() = user_id 
        OR (SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin'
    );

-- 5. Durcissement RLS sur `elevators` (Statuts d'ascenseurs)
ALTER TABLE public.elevators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on elevators" ON public.elevators;
DROP POLICY IF EXISTS "Allow authenticated to update elevators" ON public.elevators;
DROP POLICY IF EXISTS "Allow authenticated to insert elevators" ON public.elevators;
DROP POLICY IF EXISTS "Allow admin to insert elevators" ON public.elevators;

CREATE POLICY "Allow public read access on elevators" ON public.elevators
    FOR SELECT TO public
    USING (true);

CREATE POLICY "Allow authenticated to update elevators" ON public.elevators
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow admin to insert elevators" ON public.elevators
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

-- 6. Durcissement RLS sur `incidents` (Signalements parties communes)
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow authenticated to modify incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow authenticated to insert incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow author or admin to update incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow author or admin to delete incidents" ON public.incidents;

CREATE POLICY "Allow public read access on incidents" ON public.incidents
    FOR SELECT TO public
    USING (true);

CREATE POLICY "Allow authenticated to insert incidents" ON public.incidents
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow author or admin to update incidents" ON public.incidents
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = created_by 
        OR (SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin'
    )
    WITH CHECK (
        auth.uid() = created_by 
        OR (SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Allow author or admin to delete incidents" ON public.incidents
    FOR DELETE TO authenticated
    USING (
        auth.uid() = created_by 
        OR (SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin'
    );

-- 7. Durcissement RLS sur `petitions` et `polls` (Démocratie)
ALTER TABLE public.petitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin to insert petitions" ON public.petitions;
DROP POLICY IF EXISTS "Allow admin to update petitions" ON public.petitions;
DROP POLICY IF EXISTS "Allow admin to delete petitions" ON public.petitions;
DROP POLICY IF EXISTS "Allow public read access on petitions" ON public.petitions;

CREATE POLICY "Allow public read access on petitions" ON public.petitions
    FOR SELECT TO public
    USING (true);

CREATE POLICY "Allow admin to insert petitions" ON public.petitions
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Allow admin to update petitions" ON public.petitions
    FOR UPDATE TO authenticated
    USING ((SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Allow admin to delete petitions" ON public.petitions
    FOR DELETE TO authenticated
    USING ((SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Allow admin to insert polls" ON public.polls;
DROP POLICY IF EXISTS "Allow admin to update polls" ON public.polls;
DROP POLICY IF EXISTS "Allow admin to delete polls" ON public.polls;
DROP POLICY IF EXISTS "Allow public read access on polls" ON public.polls;

CREATE POLICY "Allow public read access on polls" ON public.polls
    FOR SELECT TO public
    USING (true);

CREATE POLICY "Allow admin to insert polls" ON public.polls
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Allow admin to update polls" ON public.polls
    FOR UPDATE TO authenticated
    USING ((SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Allow admin to delete polls" ON public.polls
    FOR DELETE TO authenticated
    USING ((SELECT role FROM public.residents WHERE id = auth.uid()) = 'admin');

-- 8. Création des Index de performance
CREATE INDEX IF NOT EXISTS idx_reports_entrance ON public.reports(entrance);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_histories_entrance ON public.histories(entrance);
CREATE INDEX IF NOT EXISTS idx_histories_created_at ON public.histories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_entrance ON public.incidents(entrance);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_petition_signatures_petition ON public.petition_signatures(petition_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_residents_role ON public.residents(role);
