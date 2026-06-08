
CREATE TABLE public.company_google_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  google_email text,
  refresh_token text,
  access_token text,
  token_expires_at timestamptz,
  spreadsheet_id text,
  sheet_sales text DEFAULT 'Ventas',
  sheet_attendance text DEFAULT 'Asistencia',
  sheet_inventory text DEFAULT 'Inventario',
  sheet_orders text DEFAULT 'Pedidos',
  failover_enabled boolean NOT NULL DEFAULT false,
  sync_enabled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_google_integrations TO authenticated;
GRANT ALL ON public.company_google_integrations TO service_role;

ALTER TABLE public.company_google_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages google integrations"
  ON public.company_google_integrations
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_cgi_updated_at
  BEFORE UPDATE ON public.company_google_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
