
-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============ MODULE ENUM ============
CREATE TYPE public.app_module AS ENUM ('dashboard', 'empleados', 'inventario', 'domicilios');

-- ============ USER COMPANY PERMISSIONS ============
CREATE TABLE public.user_company_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_company_permissions TO authenticated;
GRANT ALL ON public.user_company_permissions TO service_role;

ALTER TABLE public.user_company_permissions ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_company_module(
  _user_id uuid, _company_id uuid, _module public.app_module, _require_edit boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_company_permissions
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND module = _module
      AND can_view = true
      AND (NOT _require_edit OR can_edit = true)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_company_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.companies WHERE public.is_super_admin(_user_id)
  UNION
  SELECT DISTINCT company_id FROM public.user_company_permissions
  WHERE user_id = _user_id AND can_view = true
$$;

-- ============ POLICIES: companies ============
CREATE POLICY "Authenticated can view assigned companies"
ON public.companies FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR id IN (SELECT public.user_company_ids(auth.uid())));

CREATE POLICY "Super admin manages companies"
ON public.companies FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ POLICIES: user_company_permissions ============
CREATE POLICY "User can view own permissions"
ON public.user_company_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manages permissions"
ON public.user_company_permissions FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ ADD company_id TO DATA TABLES ============
ALTER TABLE public.employees ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.products  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.orders    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_products_company  ON public.products(company_id);
CREATE INDEX idx_orders_company    ON public.orders(company_id);

-- ============ SEED 4 COMPANIES ============
INSERT INTO public.companies (name, slug, description) VALUES
  ('Charcutería Apolo',     'charcuteria-apolo',     'Charcutería principal del grupo'),
  ('Distribuidora Apolo',   'distribuidora-apolo',   'Distribución y logística'),
  ('Restaurante Apolo',     'restaurante-apolo',     'Restaurante y catering'),
  ('Apolo Express',         'apolo-express',         'Tienda y domicilios rápidos');

-- Assign existing seed data to first company
UPDATE public.employees SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE public.products  SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE public.orders    SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;

-- ============ PROMOTE EXISTING USER(S) TO SUPER ADMIN ============
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::public.app_role FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- ============ UPDATE handle_new_user TO ALSO MAKE FIRST USER SUPER_ADMIN ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count int;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'), (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ============ REPLACE RLS ON DATA TABLES WITH COMPANY-SCOPED ============
-- Drop existing permissive policies and recreate scoped by company permissions

-- EMPLOYEES
DROP POLICY IF EXISTS "Staff can view employees" ON public.employees;
DROP POLICY IF EXISTS "Staff can manage employees" ON public.employees;
CREATE POLICY "View employees by company permission"
ON public.employees FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_module(auth.uid(), company_id, 'empleados', false));
CREATE POLICY "Manage employees by company permission"
ON public.employees FOR ALL TO authenticated
USING (public.has_company_module(auth.uid(), company_id, 'empleados', true))
WITH CHECK (public.has_company_module(auth.uid(), company_id, 'empleados', true));

-- ATTENDANCE (scoped via employee)
DROP POLICY IF EXISTS "Staff can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can manage attendance" ON public.attendance;
CREATE POLICY "View attendance by company permission"
ON public.attendance FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id
  AND (e.company_id IS NULL OR public.has_company_module(auth.uid(), e.company_id, 'empleados', false))));
CREATE POLICY "Manage attendance by company permission"
ON public.attendance FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id
  AND public.has_company_module(auth.uid(), e.company_id, 'empleados', true)))
WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id
  AND public.has_company_module(auth.uid(), e.company_id, 'empleados', true)));

-- PRODUCTS
DROP POLICY IF EXISTS "Staff can view products" ON public.products;
DROP POLICY IF EXISTS "Staff can manage products" ON public.products;
CREATE POLICY "View products by company permission"
ON public.products FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_module(auth.uid(), company_id, 'inventario', false));
CREATE POLICY "Manage products by company permission"
ON public.products FOR ALL TO authenticated
USING (public.has_company_module(auth.uid(), company_id, 'inventario', true))
WITH CHECK (public.has_company_module(auth.uid(), company_id, 'inventario', true));

-- INVENTORY MOVEMENTS (scoped via product)
DROP POLICY IF EXISTS "Staff can view movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Staff can manage movements" ON public.inventory_movements;
CREATE POLICY "View movements by company permission"
ON public.inventory_movements FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id
  AND (p.company_id IS NULL OR public.has_company_module(auth.uid(), p.company_id, 'inventario', false))));
CREATE POLICY "Manage movements by company permission"
ON public.inventory_movements FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id
  AND public.has_company_module(auth.uid(), p.company_id, 'inventario', true)))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id
  AND public.has_company_module(auth.uid(), p.company_id, 'inventario', true)));

-- ORDERS
DROP POLICY IF EXISTS "Staff can view orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can manage orders" ON public.orders;
CREATE POLICY "View orders by company permission"
ON public.orders FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_module(auth.uid(), company_id, 'domicilios', false));
CREATE POLICY "Manage orders by company permission"
ON public.orders FOR ALL TO authenticated
USING (public.has_company_module(auth.uid(), company_id, 'domicilios', true))
WITH CHECK (public.has_company_module(auth.uid(), company_id, 'domicilios', true));

-- ORDER ITEMS (scoped via order)
DROP POLICY IF EXISTS "Staff can view order_items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can manage order_items" ON public.order_items;
CREATE POLICY "View order_items by company permission"
ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
  AND (o.company_id IS NULL OR public.has_company_module(auth.uid(), o.company_id, 'domicilios', false))));
CREATE POLICY "Manage order_items by company permission"
ON public.order_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
  AND public.has_company_module(auth.uid(), o.company_id, 'domicilios', true)))
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
  AND public.has_company_module(auth.uid(), o.company_id, 'domicilios', true)));

-- ============ TRIGGER updated_at on new tables ============
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ucp_updated BEFORE UPDATE ON public.user_company_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
