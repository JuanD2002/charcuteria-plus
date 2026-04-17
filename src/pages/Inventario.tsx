import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  min_stock: number;
}

const Inventario = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [openProd, setOpenProd] = useState(false);
  const [openMov, setOpenMov] = useState(false);
  const [movType, setMovType] = useState<"entrada" | "salida">("entrada");
  const [prodForm, setProdForm] = useState({ name: "", category: "", unit: "kg", cost: "", price: "", stock: "0", min_stock: "0" });
  const [movForm, setMovForm] = useState({ product_id: "", quantity: "", unit_price: "", reason: "" });

  useEffect(() => { void load(); }, []);

  const load = async () => {
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("inventory_movements").select("*, products(name, unit)").order("created_at", { ascending: false }).limit(50),
    ]);
    setProducts(prods ?? []);
    setMovements(movs ?? []);
  };

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  const submitProduct = async () => {
    if (!prodForm.name.trim() || !prodForm.category.trim()) {
      toast.error("Completa nombre y categoría");
      return;
    }
    const { error } = await supabase.from("products").insert({
      name: prodForm.name.trim(),
      category: prodForm.category.trim(),
      unit: prodForm.unit,
      cost: Number(prodForm.cost) || 0,
      price: Number(prodForm.price) || 0,
      stock: Number(prodForm.stock) || 0,
      min_stock: Number(prodForm.min_stock) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Producto creado");
    setOpenProd(false);
    setProdForm({ name: "", category: "", unit: "kg", cost: "", price: "", stock: "0", min_stock: "0" });
    void load();
  };

  const openMovement = (type: "entrada" | "salida") => {
    setMovType(type);
    setMovForm({ product_id: "", quantity: "", unit_price: "", reason: "" });
    setOpenMov(true);
  };

  const submitMovement = async () => {
    if (!movForm.product_id || !movForm.quantity) {
      toast.error("Selecciona producto y cantidad");
      return;
    }
    const qty = Number(movForm.quantity);
    if (qty <= 0) return toast.error("Cantidad inválida");
    const prod = products.find((p) => p.id === movForm.product_id);
    if (movType === "salida" && prod && qty > Number(prod.stock)) {
      return toast.error(`Stock insuficiente (disponible: ${prod.stock} ${prod.unit})`);
    }
    const defaultPrice = prod ? (movType === "entrada" ? prod.cost : prod.price) : 0;
    const { error } = await supabase.from("inventory_movements").insert({
      product_id: movForm.product_id,
      type: movType,
      quantity: qty,
      unit_price: Number(movForm.unit_price) || defaultPrice,
      reason: movForm.reason.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`${movType === "entrada" ? "Entrada" : "Salida"} registrada`);
    setOpenMov(false);
    void load();
  };

  const lowStock = products.filter((p) => Number(p.stock) <= Number(p.min_stock));
  const totalValue = products.reduce((s, p) => s + Number(p.stock) * Number(p.cost), 0);

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Productos, stock y movimientos"
        icon={<Package className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openMovement("entrada")}><ArrowDownToLine className="h-4 w-4 mr-2" />Entrada</Button>
            <Button variant="outline" onClick={() => openMovement("salida")}><ArrowUpFromLine className="h-4 w-4 mr-2" />Salida</Button>
            <Dialog open={openProd} onOpenChange={setOpenProd}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Producto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo producto</DialogTitle></DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label>Nombre *</Label><Input value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} maxLength={100} /></div>
                  <div><Label>Categoría *</Label><Input value={prodForm.category} onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })} maxLength={50} /></div>
                  <div><Label>Unidad</Label>
                    <Select value={prodForm.unit} onValueChange={(v) => setProdForm({ ...prodForm, unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="unidad">unidad</SelectItem>
                        <SelectItem value="lt">lt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Costo</Label><Input type="number" value={prodForm.cost} onChange={(e) => setProdForm({ ...prodForm, cost: e.target.value })} /></div>
                  <div><Label>Precio venta</Label><Input type="number" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} /></div>
                  <div><Label>Stock inicial</Label><Input type="number" value={prodForm.stock} onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })} /></div>
                  <div><Label>Stock mínimo</Label><Input type="number" value={prodForm.min_stock} onChange={(e) => setProdForm({ ...prodForm, min_stock: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={submitProduct}>Guardar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {lowStock.length > 0 && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm"><strong>{lowStock.length}</strong> producto(s) por debajo del stock mínimo.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
        <Card><CardContent className="p-4"><p className="text-muted-foreground text-xs">Productos</p><p className="text-2xl font-bold font-display">{products.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-muted-foreground text-xs">Valor inventario</p><p className="text-2xl font-bold font-display">{fmtCOP(totalValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-muted-foreground text-xs">Movimientos hoy</p><p className="text-2xl font-bold font-display">{movements.filter((m) => new Date(m.created_at).toDateString() === new Date().toDateString()).length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock actual</TabsTrigger>
          <TabsTrigger value="history">Historial movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Producto</TableHead><TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Costo</TableHead><TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {products.map((p) => {
                  const low = Number(p.stock) <= Number(p.min_stock);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{Number(p.stock).toFixed(2)} {p.unit}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{Number(p.min_stock).toFixed(0)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtCOP(Number(p.cost))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtCOP(Number(p.price))}</TableCell>
                      <TableCell>{low ? <Badge className="bg-warning text-warning-foreground">Bajo</Badge> : <Badge className="bg-success text-success-foreground">OK</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fecha</TableHead><TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead><TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unit.</TableHead><TableHead>Motivo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{format(new Date(m.created_at), "dd MMM HH:mm", { locale: es })}</TableCell>
                    <TableCell>{m.products?.name}</TableCell>
                    <TableCell>
                      {m.type === "entrada"
                        ? <Badge className="bg-success text-success-foreground"><ArrowDownToLine className="h-3 w-3 mr-1" />Entrada</Badge>
                        : <Badge className="bg-info text-info-foreground"><ArrowUpFromLine className="h-3 w-3 mr-1" />Salida</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(m.quantity).toFixed(2)} {m.products?.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCOP(Number(m.unit_price))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Movement dialog */}
      <Dialog open={openMov} onOpenChange={setOpenMov}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar {movType === "entrada" ? "entrada (compra)" : "salida (venta)"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Producto</Label>
              <Select value={movForm.product_id} onValueChange={(v) => setMovForm({ ...movForm, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — stock: {Number(p.stock).toFixed(2)} {p.unit}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad</Label><Input type="number" step="0.01" value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })} /></div>
              <div><Label>Precio unitario</Label><Input type="number" value={movForm.unit_price} onChange={(e) => setMovForm({ ...movForm, unit_price: e.target.value })} placeholder="auto" /></div>
            </div>
            <div><Label>Motivo</Label><Input value={movForm.reason} onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })} maxLength={120} placeholder={movType === "entrada" ? "Compra proveedor" : "Venta mostrador"} /></div>
          </div>
          <DialogFooter><Button onClick={submitMovement}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventario;
