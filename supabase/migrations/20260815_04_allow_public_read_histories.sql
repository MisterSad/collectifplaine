-- ==============================================================================
-- MIGRATION : Autorisation de lecture publique sur la table histories
-- Date : 15 Août 2026
-- Description : Permet aux locataires et visiteurs d'accéder à l'historique complet des pannes
-- ==============================================================================

ALTER TABLE public.histories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on histories" ON public.histories;
DROP POLICY IF EXISTS "Allow authenticated to view histories" ON public.histories;

CREATE POLICY "Allow public read access on histories" ON public.histories
    FOR SELECT TO public
    USING (true);
