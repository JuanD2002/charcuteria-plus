-- Helper: any staff role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','manager')
  );
$$;

-- Replace permissive write policies
DROP POLICY "Authenticated write employees" ON public.employees;
CREATE POLICY "Staff write employees" ON public.employees
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY "Authenticated write attendance" ON public.attendance;
CREATE POLICY "Staff write attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY "Authenticated write products" ON public.products;
CREATE POLICY "Staff write products" ON public.products
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY "Authenticated write movements" ON public.inventory_movements;
CREATE POLICY "Staff write movements" ON public.inventory_movements
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY "Authenticated write orders" ON public.orders;
CREATE POLICY "Staff write orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY "Authenticated write order_items" ON public.order_items;
CREATE POLICY "Staff write order_items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));