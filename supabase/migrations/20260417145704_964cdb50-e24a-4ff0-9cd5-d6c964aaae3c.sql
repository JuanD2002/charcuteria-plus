-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'viewer');
CREATE TYPE public.order_status AS ENUM ('pendiente', 'en_camino', 'entregado', 'cancelado');
CREATE TYPE public.movement_type AS ENUM ('entrada', 'salida');

-- ============= UPDATED_AT FUNCTION =============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============= AUTO PROFILE + FIRST ADMIN =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= EMPLOYEES =============
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  document_number TEXT NOT NULL UNIQUE,
  position TEXT NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_delivery BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write employees" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= ATTENDANCE =============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out TIMESTAMPTZ,
  expected_start TIME DEFAULT '08:00:00',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write attendance" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_attendance_employee ON public.attendance(employee_id, check_in DESC);

-- ============= PRODUCTS =============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock NUMERIC(10,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= INVENTORY MOVEMENTS =============
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type movement_type NOT NULL,
  quantity NUMERIC(10,3) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read movements" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write movements" ON public.inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_movements_product ON public.inventory_movements(product_id, created_at DESC);

-- Trigger: auto-update product stock
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type = 'entrada' THEN
    UPDATE public.products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  ELSE
    UPDATE public.products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();

-- ============= ORDERS =============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  address TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pendiente',
  delivery_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC(10,3) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read order_items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write order_items" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============= SEED DATA =============
INSERT INTO public.employees (full_name, document_number, position, hourly_rate, is_delivery) VALUES
  ('Carlos Ramírez', 'CC1001', 'Charcutero', 8500, false),
  ('María López', 'CC1002', 'Cajera', 7500, false),
  ('Andrés Gómez', 'CC1003', 'Domiciliario', 7000, true),
  ('Laura Pérez', 'CC1004', 'Domiciliario', 7000, true),
  ('Sofía Vargas', 'CC1005', 'Auxiliar', 6500, false);

INSERT INTO public.products (name, category, unit, cost, price, stock, min_stock) VALUES
  ('Jamón Serrano', 'Embutidos', 'kg', 35000, 58000, 12.5, 5),
  ('Salami Italiano', 'Embutidos', 'kg', 28000, 45000, 8.0, 4),
  ('Chorizo Español', 'Embutidos', 'kg', 22000, 36000, 3.2, 4),
  ('Queso Manchego', 'Quesos', 'kg', 42000, 68000, 6.5, 3),
  ('Queso Brie', 'Quesos', 'kg', 38000, 60000, 2.1, 3),
  ('Prosciutto', 'Embutidos', 'kg', 55000, 89000, 4.0, 2),
  ('Aceitunas Kalamata', 'Acompañamientos', 'kg', 18000, 32000, 9.8, 5),
  ('Pan Artesanal', 'Panadería', 'unidad', 3500, 6500, 24, 10);

-- attendance hoy
INSERT INTO public.attendance (employee_id, check_in, check_out)
SELECT id, now() - interval '6 hours', NULL FROM public.employees WHERE document_number IN ('CC1001','CC1002','CC1003');
INSERT INTO public.attendance (employee_id, check_in, check_out)
SELECT id, now() - interval '8 hours', now() - interval '1 hour' FROM public.employees WHERE document_number = 'CC1005';

-- pedidos de ejemplo
INSERT INTO public.orders (customer_name, customer_phone, address, total, status, delivery_employee_id, dispatched_at)
SELECT 'Juan Restrepo', '3001234567', 'Cra 45 #12-34, Medellín', 145000, 'en_camino', id, now() - interval '20 minutes'
FROM public.employees WHERE document_number = 'CC1003';

INSERT INTO public.orders (customer_name, customer_phone, address, total, status)
VALUES ('Diana Castro', '3019876543', 'Calle 10 #5-67, Medellín', 89000, 'pendiente');

INSERT INTO public.orders (customer_name, customer_phone, address, total, status, delivery_employee_id, dispatched_at, delivered_at)
SELECT 'Pedro Marín', '3115551234', 'Av Las Vegas #80-15', 215000, 'entregado', id,
  now() - interval '3 hours', now() - interval '2 hours'
FROM public.employees WHERE document_number = 'CC1004';

-- movimientos de inventario (ventas hoy)
INSERT INTO public.inventory_movements (product_id, type, quantity, unit_price, reason)
SELECT id, 'salida', 0.5, price, 'Venta mostrador' FROM public.products WHERE name = 'Jamón Serrano';
INSERT INTO public.inventory_movements (product_id, type, quantity, unit_price, reason)
SELECT id, 'salida', 0.3, price, 'Venta mostrador' FROM public.products WHERE name = 'Queso Manchego';
INSERT INTO public.inventory_movements (product_id, type, quantity, unit_price, reason)
SELECT id, 'entrada', 5.0, cost, 'Compra proveedor' FROM public.products WHERE name = 'Salami Italiano';