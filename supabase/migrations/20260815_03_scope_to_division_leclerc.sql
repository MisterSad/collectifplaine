-- Migration 20260815_03: Restreindre les ascenseurs aux 8 immeubles de l'Avenue de la Division Leclerc (38 à 52)

-- 1. Nettoyer les signalements et historiques des autres entrées
DELETE FROM public.reports WHERE entrance NOT IN ('38', '40', '42', '44', '46', '48', '50', '52');
DELETE FROM public.histories WHERE entrance NOT IN ('38', '40', '42', '44', '46', '48', '50', '52');

-- 2. Supprimer les ascenseurs hors Avenue Division Leclerc
DELETE FROM public.elevators WHERE id NOT IN ('38', '40', '42', '44', '46', '48', '50', '52');

-- 3. Assurer la présence des 8 ascenseurs de l'Avenue Division Leclerc
INSERT INTO public.elevators (id, status, last_status_change, maintenance_notes)
VALUES 
    ('38', 'en_service', NOW(), ''),
    ('40', 'en_service', NOW(), ''),
    ('42', 'en_service', NOW(), ''),
    ('44', 'en_service', NOW(), ''),
    ('46', 'en_service', NOW(), ''),
    ('48', 'en_service', NOW(), ''),
    ('50', 'en_service', NOW(), ''),
    ('52', 'en_service', NOW(), '')
ON CONFLICT (id) DO NOTHING;
