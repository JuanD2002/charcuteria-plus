
-- Super admin can see all profiles
CREATE POLICY "Super admin views all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Super admin manages user_roles
CREATE POLICY "Super admin views all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Super admin manages roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
