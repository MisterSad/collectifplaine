-- Migration: Add Petitions and Polls/Voting Tables with RLS Policies
-- Target: Supabase Database

-- 1. Table: petitions
CREATE TABLE IF NOT EXISTS public.petitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: petition_signatures
CREATE TABLE IF NOT EXISTS public.petition_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    petition_id UUID NOT NULL REFERENCES public.petitions(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_petition_resident UNIQUE (petition_id, resident_id)
);

-- 3. Table: polls
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sondage', 'vote_resolution')),
    options JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed'))
);

-- 4. Table: poll_votes
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_poll_resident UNIQUE (poll_id, resident_id)
);

-- 5. Activer le Row Level Security (RLS)
ALTER TABLE public.petitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- 6. Définir les politiques de sécurité (Policies)

-- POLITIQUES : petitions
DROP POLICY IF EXISTS "Allow public select on petitions" ON public.petitions;
CREATE POLICY "Allow public select on petitions" ON public.petitions
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow admin to insert petitions" ON public.petitions;
CREATE POLICY "Allow admin to insert petitions" ON public.petitions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IN (SELECT id FROM public.residents WHERE username = 'Tavares50'));

-- POLITIQUES : petition_signatures
DROP POLICY IF EXISTS "Allow public select on signatures" ON public.petition_signatures;
CREATE POLICY "Allow public select on signatures" ON public.petition_signatures
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert their own signature" ON public.petition_signatures;
CREATE POLICY "Allow authenticated to insert their own signature" ON public.petition_signatures
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = resident_id);

-- POLITIQUES : polls
DROP POLICY IF EXISTS "Allow public select on polls" ON public.polls;
CREATE POLICY "Allow public select on polls" ON public.polls
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow admin to insert polls" ON public.polls;
CREATE POLICY "Allow admin to insert polls" ON public.polls
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IN (SELECT id FROM public.residents WHERE username = 'Tavares50'));

DROP POLICY IF EXISTS "Allow authenticated to update polls" ON public.polls;
CREATE POLICY "Allow authenticated to update polls" ON public.polls
    FOR UPDATE TO authenticated
    USING (auth.uid() IN (SELECT id FROM public.residents WHERE username = 'Tavares50'))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.residents WHERE username = 'Tavares50'));

-- POLITIQUES : poll_votes
DROP POLICY IF EXISTS "Allow public select on poll_votes" ON public.poll_votes;
CREATE POLICY "Allow public select on poll_votes" ON public.poll_votes
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert their own vote" ON public.poll_votes;
CREATE POLICY "Allow authenticated to insert their own vote" ON public.poll_votes
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = resident_id);
