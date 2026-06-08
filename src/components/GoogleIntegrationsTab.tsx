import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Building2, Save, FileSpreadsheet, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";

interface GIntegration {
  id?: string;
  company_id: string;
  google_email: string | null;
  spreadsheet_id: string | null;
  sheet_sales: string;
  sheet_attendance: string;
  sheet_inventory: string;
  sheet_orders: string;
  failover_enabled: boolean;
  sync_enabled: boolean;
  last_synced_at: string | null;
}

const empty = (company_id: string): GIntegration => ({
  company_id,
  google_email: null,
  spreadsheet_id: null,
  sheet_sales: "Ventas",
  sheet_attendance: "Asistencia",
  sheet_inventory: "Inventario",
  sheet_orders: "Pedidos",
  failover_enabled: false,
  sync_enabled: false,
  last_synced_at: null,
});

export default function GoogleIntegrationsTab() {
  const { companies } = useCompany();
  const [data, setData] = useState<Record<string, GIntegration>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { void load(); }, [companies.length]);

  const load = async () => {
    const { data: rows } = await supabase.from("company_google_integrations" as any).select("*");
    const map: Record<string, GIntegration> = {};
    companies.forEach((c) => { map[c.id] = empty(c.id); });
    (rows ?? []).forEach((r: any) => { map[r.company_id] = r; });
    setData(map);
  };

  const update = (cid: string, patch: Partial<GIntegration>) =>
    setData((d) => ({ ...d, [cid]: { ...d[cid], ...patch } }));

  const save = async (cid: string) => {
    setSaving(cid);
    const row = data[cid];
    const { error } = await supabase
      .from("company_google_integrations" as any)
      .upsert({ ...row, company_id: cid }, { onConflict: "company_id" });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Configuración guardada");
    void load();
  };

  return (
    <div className="space-y-4">
      <Card className="border-info/30 bg-info/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-info" /> Cómo configurarlo
          </CardTitle>
          <CardDescription className="space-y-2 text-foreground">
            <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
              <li>Para cada empresa, crea una hoja de cálculo de Google con pestañas: <strong>Ventas, Asistencia, Inventario, Pedidos</strong>.</li>
              <li>Comparte la hoja con la cuenta de servicio de Google (ver instrucciones en el chat) con permiso de lectura.</li>
              <li>Pega el <strong>Spreadsheet ID</strong> (el segmento entre <code>/d/</code> y <code>/edit</code> en la URL).</li>
              <li>Activa <strong>failover</strong>: si la base de datos falla, el dashboard leerá desde Sheets.</li>
              <li>Activa <strong>sync</strong>: cada cambio relevante se replicará a Sheets (requiere edge function programada).</li>
            </ol>
          </CardDescription>
        </CardHeader>
      </Card>

      {companies.map((c) => {
        const g = data[c.id] ?? empty(c.id);
        const sheetUrl = g.spreadsheet_id ? `https://docs.google.com/spreadsheets/d/${g.spreadsheet_id}/edit` : null;
        return (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" /> {c.name}
                {g.failover_enabled && <Badge variant="outline" className="border-success text-success">failover activo</Badge>}
                {g.sync_enabled && <Badge variant="outline" className="border-info text-info">sync activo</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Spreadsheet ID</Label>
                  <Input
                    value={g.spreadsheet_id ?? ""}
                    onChange={(e) => update(c.id, { spreadsheet_id: e.target.value || null })}
                    placeholder="1BxiMVs0XRA5..."
                  />
                </div>
                <div>
                  <Label>Email de Google (informativo)</Label>
                  <Input
                    value={g.google_email ?? ""}
                    onChange={(e) => update(c.id, { google_email: e.target.value || null })}
                    placeholder="empresa@gmail.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><Label className="text-xs">Pestaña Ventas</Label><Input value={g.sheet_sales} onChange={(e) => update(c.id, { sheet_sales: e.target.value })} /></div>
                <div><Label className="text-xs">Pestaña Asistencia</Label><Input value={g.sheet_attendance} onChange={(e) => update(c.id, { sheet_attendance: e.target.value })} /></div>
                <div><Label className="text-xs">Pestaña Inventario</Label><Input value={g.sheet_inventory} onChange={(e) => update(c.id, { sheet_inventory: e.target.value })} /></div>
                <div><Label className="text-xs">Pestaña Pedidos</Label><Input value={g.sheet_orders} onChange={(e) => update(c.id, { sheet_orders: e.target.value })} /></div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={g.failover_enabled} onCheckedChange={(v) => update(c.id, { failover_enabled: v })} />
                  Activar failover (leer desde Sheets si la BD falla)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={g.sync_enabled} onCheckedChange={(v) => update(c.id, { sync_enabled: v })} />
                  Sincronizar BD → Sheets
                </label>
                <div className="ml-auto flex gap-2">
                  {sheetUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={sheetUrl} target="_blank" rel="noreferrer"><FileSpreadsheet className="h-4 w-4 mr-2" />Abrir <ExternalLink className="h-3 w-3 ml-1" /></a>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => save(c.id)} disabled={saving === c.id}>
                    <Save className="h-4 w-4 mr-2" />{saving === c.id ? "Guardando…" : "Guardar"}
                  </Button>
                </div>
              </div>
              {g.last_synced_at && (
                <p className="text-xs text-muted-foreground">Última sincronización: {new Date(g.last_synced_at).toLocaleString("es-CO")}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
