DROP POLICY IF EXISTS "Admins can modify team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can modify teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can modify team_functions" ON public.team_functions;
CREATE POLICY "Authenticated can modify team_members" ON public.team_members FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can modify teams" ON public.teams FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can modify team_functions" ON public.team_functions FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members, public.teams, public.team_functions TO authenticated;
GRANT ALL ON public.team_members, public.teams, public.team_functions TO service_role;