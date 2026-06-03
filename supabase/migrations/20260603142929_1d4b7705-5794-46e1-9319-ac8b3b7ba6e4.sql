-- Activation flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET is_active = true WHERE is_active = false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  INSERT INTO public.profiles (user_id, display_name, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    user_count = 1
  );
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'), (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_profile_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT is_active FROM public.profiles WHERE user_id = _user_id), false) $$;

DROP POLICY IF EXISTS "Super admin updates profiles" ON public.profiles;
CREATE POLICY "Super admin updates profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Sedes
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  manager_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View branches by company permission" ON public.branches FOR SELECT TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'sedes'::app_module, false));
CREATE POLICY "Manage branches by company permission" ON public.branches FOR ALL TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'sedes'::app_module, true))
  WITH CHECK (public.has_company_module(auth.uid(), company_id, 'sedes'::app_module, true));
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recetas
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  yield_quantity numeric NOT NULL DEFAULT 1,
  yield_unit text NOT NULL DEFAULT 'porciones',
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View recipes by company permission" ON public.recipes FOR SELECT TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'recetas'::app_module, false));
CREATE POLICY "Manage recipes by company permission" ON public.recipes FOR ALL TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'recetas'::app_module, true))
  WITH CHECK (public.has_company_module(auth.uid(), company_id, 'recetas'::app_module, true));
CREATE TRIGGER trg_recipes_updated BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_ingredients TO service_role;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View ingredients by recipe permission" ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND public.has_company_module(auth.uid(), r.company_id, 'recetas'::app_module, false)));
CREATE POLICY "Manage ingredients by recipe permission" ON public.recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND public.has_company_module(auth.uid(), r.company_id, 'recetas'::app_module, true)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND public.has_company_module(auth.uid(), r.company_id, 'recetas'::app_module, true)));

-- Alarmas
CREATE TABLE IF NOT EXISTS public.alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'info',
  trigger_at timestamptz,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alarms TO authenticated;
GRANT ALL ON public.alarms TO service_role;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View alarms by company permission" ON public.alarms FOR SELECT TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'alarmas'::app_module, false));
CREATE POLICY "Manage alarms by company permission" ON public.alarms FOR ALL TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'alarmas'::app_module, true))
  WITH CHECK (public.has_company_module(auth.uid(), company_id, 'alarmas'::app_module, true));
CREATE TRIGGER trg_alarms_updated BEFORE UPDATE ON public.alarms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Manuales
CREATE TABLE IF NOT EXISTS public.manual_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_categories TO authenticated;
GRANT ALL ON public.manual_categories TO service_role;
ALTER TABLE public.manual_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View manual categories by company" ON public.manual_categories FOR SELECT TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'manuales'::app_module, false));
CREATE POLICY "Manage manual categories by company" ON public.manual_categories FOR ALL TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'manuales'::app_module, true))
  WITH CHECK (public.has_company_module(auth.uid(), company_id, 'manuales'::app_module, true));

CREATE TABLE IF NOT EXISTS public.manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.manual_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manuals TO authenticated;
GRANT ALL ON public.manuals TO service_role;
ALTER TABLE public.manuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View manuals by company permission" ON public.manuals FOR SELECT TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'manuales'::app_module, false));
CREATE POLICY "Manage manuals by company permission" ON public.manuals FOR ALL TO authenticated
  USING (public.has_company_module(auth.uid(), company_id, 'manuales'::app_module, true))
  WITH CHECK (public.has_company_module(auth.uid(), company_id, 'manuales'::app_module, true));
CREATE TRIGGER trg_manuals_updated BEFORE UPDATE ON public.manuals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for manuals bucket (path: {company_id}/filename.pdf)
CREATE POLICY "View manual files by company permission" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'manuals'
    AND public.has_company_module(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manuales'::app_module, false));
CREATE POLICY "Upload manual files by company permission" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manuals'
    AND public.has_company_module(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manuales'::app_module, true));
CREATE POLICY "Update manual files by company permission" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'manuals'
    AND public.has_company_module(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manuales'::app_module, true));
CREATE POLICY "Delete manual files by company permission" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'manuals'
    AND public.has_company_module(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manuales'::app_module, true));