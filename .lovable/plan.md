# Plan: Alarmas entre empresas + Selección por sede + CRUD admin

## 1. Alarmas entre empresas
- Migración: añadir `target_company_id` (uuid, nullable) a `alarms`. Si es null = alarma interna de la empresa origen. Si tiene valor = alarma dirigida a otra empresa.
- Ajustar políticas RLS para que la empresa destino también pueda VER y RESOLVER la alarma (con permiso `alarmas`).
- UI `Alarmas.tsx`:
  - Al crear, selector "Dirigir a empresa" (opcional) con la lista de empresas visibles.
  - Tabla muestra origen/destino y filtros: Recibidas / Enviadas / Internas.
  - Editar alarma (título, descripción, severidad, destino) — solo creador o super admin.

## 2. Selección de sede al iniciar sesión
- Migración: añadir `active_branch_id` opcional al contexto (solo cliente — guardado en `localStorage`). No requiere columna nueva en DB.
- Nueva pantalla `/` (CompanySelector) en dos pasos:
  1. Elegir empresa → 2. Elegir sede (lista de `branches` de esa empresa, o "Todas las sedes").
- Extender `useCompany` con `activeBranchId`, `setActiveBranchId`, `branches[]`, y persistencia.
- `CompanySwitcher` (header) muestra "Empresa · Sede" y permite cambiar ambas; click en el nombre vuelve a `/`.

## 3. Scoping por sede en los módulos
- Migración: añadir `branch_id uuid` (nullable) a las tablas operacionales: `employees`, `inventory_movements`, `products`, `orders`, `recipes`, `alarms`. Nullable para no romper datos existentes (= "global de empresa").
- En las páginas (`Empleados`, `Inventario`, `Domicilios`, `Recetas`, `Alarmas`): filtrar por `activeBranchId` cuando esté seleccionado; permitir asignar sede al crear.
- Dashboard: añadir filtro por sede activa y mostrar las alarmas recibidas/internas activas como widget de "Alertas".

## 4. Admin: empresas y sedes
- En `Admin.tsx` añadir pestaña "Empresas" con CRUD (crear/editar/desactivar empresa).
- En la misma pestaña, sub-sección de sedes por empresa (reutiliza la lógica de `Sedes.tsx`) para que el super admin pueda crear sedes de cualquier empresa sin entrar al módulo.

## Detalles técnicos
- Tablas afectadas y nuevas columnas se agregan con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Políticas RLS actualizadas:
  - `alarms` SELECT/UPDATE: permitido si `company_id` ∈ user_company_ids **o** `target_company_id` ∈ user_company_ids con permiso `alarmas`.
- `useCompany` expone `branches` recargadas cuando cambia `activeCompanyId`.
- Widget de alertas en Dashboard: top 5 alarmas no resueltas (recibidas + internas) con badge de severidad.

## Fuera de alcance (por ahora)
- Notificaciones en tiempo realtime (se puede agregar luego con Supabase Realtime).
- Migrar datos existentes a una sede específica (quedan como "global de empresa").

¿Apruebas para implementar?
