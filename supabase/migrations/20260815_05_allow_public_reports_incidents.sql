-- ==============================================================================
-- MIGRATION : RLS permissive pour signalements publics (locataires & anonymes)
-- Date : 15 Août 2026
-- Description : Permet l'insertion de signalements de panne et incidents par les locataires même non connectés
-- ==============================================================================

-- 1. Reports (Signalements pannes ascenseurs)
DROP POLICY IF EXISTS "Allow authenticated to insert reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public to insert reports" ON public.reports;
CREATE POLICY "Allow public to insert reports" ON public.reports
    FOR INSERT TO public
    WITH CHECK (true);

-- 2. Histories (Historique des pannes)
DROP POLICY IF EXISTS "Allow authenticated to insert histories" ON public.histories;
DROP POLICY IF EXISTS "Allow public to insert histories" ON public.histories;
CREATE POLICY "Allow public to insert histories" ON public.histories
    FOR INSERT TO public
    WITH CHECK (true);

-- 3. Incidents (Signalements parties communes)
DROP POLICY IF EXISTS "Allow authenticated to insert incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow public to insert incidents" ON public.incidents;
CREATE POLICY "Allow public to insert incidents" ON public.incidents
    FOR INSERT TO public
    WITH CHECK (true);

-- 4. Elevators (Mise à jour du statut lors d'un signalement)
DROP POLICY IF EXISTS "Allow authenticated to update elevators" ON public.elevators;
DROP POLICY IF EXISTS "Allow public to update elevators" ON public.elevators;
CREATE POLICY "Allow public to update elevators" ON public.elevators
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);
