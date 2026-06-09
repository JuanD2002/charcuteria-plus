
-- 1. Alarmas entre empresas
ALTER TABLE public.alarms
  ADD COLUMN IF NOT EXISTS target_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_alarms_target_company ON public.alarms(target_company_id);

-- Reemplazar políticas para incluir empresa destino
DROP POLICY IF EXISTS "View alarms by company permission" ON public.alarms;
DROP POLICY IF EXISTS "Manage alarms by company permission" ON public.alarms;

CREATE POLICY "View alarms (origin or target)" ON public.alarms
  FOR SELECT USING (
    public.has_company_module(auth.uid(), company_id, 'alarmas'::app_module, false)
    OR (target_company_id IS NOT NULL AND public.has_company_module(auth.uid(), target_company_id, 'alarmas'::app_module, false))
  );

CREATE POLICY "Insert alarms by origin permission" ON public.alarms
  FOR INSERT WITH CHECK (
    public.has_company_module(auth.uid(), company_id, 'alarmas'::app_module, true)
  );

CREATE POLICY "Update alarms (origin or target)" ON public.alarms
  FOR UPDATE USING (
    public.has_company_module(auth.uid(), company_id, 'alarmas'::app_module, true)
    OR (target_company_id IS NOT NULL AND public.has_company_module(auth.uid(), target_company_id, 'alarmas'::app_module, true))
  ) WITH CHECK (
    public.has_company_module(auth.uid(), company_id, 'alarmas'::app_module, true)
    OR (target_company_id IS NOT NULL AND public.has_company_module(auth.uid(), target_company_id, 'alarmas'::app_module, true))
  );

CREATE POLICY "Delete alarms by origin permission" ON public.alarms
  FOR DELETE USING (
    public.has_company_module(auth.uid(), company_id, 'alarmas'::app_module, true)
  );

-- 2. Columna branch_id en tablas operativas
ALTER TABLE public.employees           ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.products            ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.orders              ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.recipes             ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.alarms              ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_branch ON public.employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_branch  ON public.products(branch_id);
CREATE INDEX IF NOT EXISTS idx_invmov_branch    ON public.inventory_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch    ON public.orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_recipes_branch   ON public.recipes(branch_id);
CREATE INDEX IF NOT EXISTS idx_alarms_branch    ON public.alarms(branch_id);
