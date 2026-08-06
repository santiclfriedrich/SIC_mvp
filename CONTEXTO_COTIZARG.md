# Cotizarg — Contexto del proyecto

> Documento de referencia del estado actual de la app **Cotizarg** (repo `SIC_mvp`,
> deploy `sic-mvp.vercel.app`). Sirve para entender la arquitectura y para planear
> la **migración/unificación** de otra app web + su Supabase + el "Panel" hacia acá.
>
> Última actualización de este doc: 2026-08-06.
> _Ubicación del código: `arg_color_mvp_next/web/` (el repo git vive en `web/`)._

---

## 1. Qué es Cotizarg

Es un **monolito Next.js (App Router)** que agrupa varias herramientas internas de
Argentina Color, separadas por **áreas** protegidas por rol. Cada área es
independiente en rutas y APIs, pero comparten auth, base de datos, layout e
integraciones (Google Sheets, Redis, etc.).

| Área | Ruta | Rol | Qué hace |
|---|---|---|---|
| **Compras / Catálogo** | `/` | ADMIN, USER, VIEWER | Comparador de precio y stock de un SKU across ~10 proveedores mayoristas (Elit, Nucleo, Invid, etc.). Es el MVP original. |
| **Corpo** | `/corpo` | CORPO, ADMIN | Reportes de Cuentas Corrientes: sube el export del ERP → genera un Google Sheet formateado (resumen + detalle + dashboard). |
| **Tiendas** | `/tiendas` | TIENDAS, ADMIN | Módulo de *pricing*: calcula precios de venta por marketplace (ICBC, Frávega, Megatone, OnCity) desde costo + fees + coeficientes; sincroniza con una "planilla viva" en Sheets. |
| **Contabilidad** | `/contabilidad` | CONTABILIDAD, ADMIN | Conciliación GBP ↔ MercadoPago: sube un `.xlsx` (4 hojas) → cruza por N° de operación → Google Sheet con cobradas / pendientes / MP sin GBP. |
| **Admin** | `/admin` | ADMIN | Gestión de usuarios (alta, rol, activo). |

---

## 2. Stack técnico

- **Framework:** Next.js **16.1.1** (App Router, Turbopack), React **19.2**.
- **Lenguaje:** JavaScript + JSX (este repo **no** usa TypeScript; el CRM-ArgColor sí).
- **Estilos:** Tailwind CSS **v4** (`@tailwindcss/postcss`). Paleta clara custom
  (`#F2F1EE` fondo, `#1A1917` tinta, acentos por área).
- **Auth:** NextAuth **v4** (`next-auth`), estrategia **JWT** (8 h), provider
  Credentials, hashing con `bcryptjs`. Adapter Prisma presente.
- **ORM / DB:** Prisma **6.19** sobre **PostgreSQL de Supabase**.
- **Cache:** Upstash Redis (REST) — cachea catálogos de proveedores.
- **Google:** `googleapis` (Sheets v4 + Drive v3) vía **service account**.
- **Parseo Excel:** `xlsx` (SheetJS).
- **Estado UI:** `zustand` (`src/store/productStore.js`, solo en Compras).
- **HTTP a proveedores:** `axios`.
- **Deploy:** Vercel (repo GitHub `santiclfriedrich/SIC_mvp`, rama `main`).

---

## 3. Estructura de carpetas (`web/src`)

```
app/
  layout.js                 # RootLayout: fuentes + <Providers> + <Header> global
  providers.jsx             # SessionProvider (+ lo que haga falta client-side)
  globals.css
  (protected)/
    layout.jsx              # exige sesión (cualquier rol) → sino /login
    page.js                 # COMPRAS: catálogo/comparador (client, usa zustand)
  login/                    # página pública de login
  admin/users/              # ADMIN: gestión de usuarios
  corpo/                    # área CORPO (layout valida rol)
    page.jsx                # panel con card
    reportes-cc/            # subida + historial + detalle [id]
  tiendas/                  # área TIENDAS (layout valida rol)
    page.jsx / precios/ / ajustes/
  contabilidad/             # área CONTABILIDAD (layout valida rol)
    page.jsx
    conciliacion/           # subida + historial (ConciliacionClient) + detalle [id]
  api/
    auth/[...nextauth]/     # handler NextAuth
    auth/seed-admin/  seed-user/   # alta de usuarios por API (protegida con ADMIN_SEED_KEY)
    products/  products/[sku]/     # COMPRAS
    warmup/                 # precalienta caches de proveedores
    diagnostics/airintra/  diagnostics/providers/
    cron/sync-{airintra,distecna,invid,microglobal}/   # Vercel Cron → Redis
    corpo/reportes-cc/  (+ /[id], /preview)
    tiendas/{config,export,planilla-viva,planilla-viva/sync,productos,productos/[sku],productos/bulk,report21,sheets}/
    contabilidad/conciliacion/  (+ /[id])

lib/
  prisma.js                 # singleton PrismaClient
  reportes-cc/              # Corpo: parser, builders (resumen/detalle/dashboard),
                            #   generador, google-client, sheets-helpers, notas-previas
  conciliacion/             # Contabilidad: parser (+cruce), builder, generador
                            #   (reutiliza google-client y sheets-helpers de reportes-cc)
  pricing/                  # Tiendas: engine, stores (defaults), config, report21,
                            #   planilla, export, sheet-sync, pricing, server, *.test.js
  controllers/productController.js   # COMPRAS: orquesta fetch + merge across proveedores
  services/<proveedor>API.js         # COMPRAS: cliente HTTP por proveedor
  models/<proveedor>Model.js         # COMPRAS: normaliza respuesta → shape común
  cache/                    # redis.js, redisCache.js, masnetCatalogCache.js
  utils/                    # mergeResults, cleanMergedProduct, withTimeout, nucleoUrl

components/                 # Header, UserMenu, Footer, LandingPage, SearchBar,
                            # ProductGrid, ProductCard, Modal, Pagination, Skeleton,
                            # SmartImage, SortFilter, WhatsNewModal
store/productStore.js       # zustand (búsqueda/orden/paginación del catálogo)
middleware.js               # gate global de auth + ruteo por rol
auth.js                     # authOptions de NextAuth
```

---

## 4. Autenticación y roles

**`src/auth.js`** — NextAuth v4:
- Provider **Credentials** (email + password). `authorize()` busca el `User`,
  chequea `isActive` y compara con `bcrypt`.
- Sesión **JWT**, `maxAge` 8 h. Los callbacks copian `id` y `role` al token y a
  `session.user`.
- `pages.signIn = "/login"`.

**Roles** (enum `Role` en Prisma): `ADMIN`, `USER`, `VIEWER`, `CORPO`, `TIENDAS`,
`CONTABILIDAD`.

**`src/middleware.js`** — dos capas:
1. **Gate de auth:** sin token → `/login` (o 401 JSON si es `/api/*`).
2. **Ruteo por rol:** los roles "de área" están **encerrados** en su área y
   cualquier otra ruta los redirige a su home:
   - `CORPO` → solo `/corpo/*` y `/api/corpo/*` (sino → `/corpo`)
   - `TIENDAS` → solo `/tiendas/*` y `/api/tiendas/*` (sino → `/tiendas`)
   - `CONTABILIDAD` → solo `/contabilidad/*` y `/api/contabilidad/*` (sino → `/contabilidad`)
   - Además, cada área exige su rol (o `ADMIN`); `/admin/*` exige `ADMIN`.
   - `ADMIN`, `USER`, `VIEWER` no están encerrados → ven el catálogo en `/`.

El `matcher` excluye `login`, `api/auth`, `api/cron`, `_next`, `favicon.ico` y
archivos con extensión.

**Login flow:** el login siempre manda a `callbackUrl="/"`; el middleware
redirige a cada rol de área a su home. Además, **cada área** tiene su
`layout.jsx` server-side que revalida el rol con `getServerSession` (defensa en
profundidad).

**Alta de usuarios:** endpoint `POST /api/auth/seed-user` (y `seed-admin`),
protegido con `ADMIN_SEED_KEY`. Body: `{ key, email, password, name, role }`.
También se pueden crear directo por Prisma (hash con `bcryptjs`, `role`, `isActive`).

---

## 5. Base de datos (Prisma + Supabase)

- **Datasource:** `postgresql`, `url = env("DATABASE_URL")` (pooler de Supabase,
  puerto 6543 — *transaction pooler*, para runtime) y
  `directUrl = env("DIRECT_URL")` (conexión directa, para migraciones).
- **Migraciones:** en `prisma/migrations/`. Se aplican con
  `npx prisma migrate deploy` (prod) o `migrate dev` (local). El enum se amplía
  en migración propia (`ALTER TYPE "Role" ADD VALUE ...`), separada de los
  `CREATE TABLE`.

**Modelos por área:**

- **Auth / core:** `User` (email, password, name, `role`, `isActive`),
  `Account`, `Session`, `VerificationToken` (los 3 últimos para el adapter).
- **Corpo:** `ReporteCC` (spreadsheetId/url, totales, `clientesJson`,
  `porVendedorJson`).
- **Contabilidad:** `ConciliacionMP` (spreadsheetId/url, contadores
  cobradas/pendientes/sobrantes, montos, `resumenJson`).
- **Tiendas / pricing:** `PricingProduct` (SKU + costo/stock/peso + `preciosJson`,
  `precios3Json`, `feesJson`), `PricingConfig` (fila única id=1, config editable),
  `Report21Row` (snapshot del último report21 por SKU), `Report21Upload`
  (metadata de la última carga + ids de Drive/planilla viva).

> ⚠️ **Gotcha de deploy (importante):** el `build` **debe** correr
> `prisma generate` (ya está en `package.json`: `"build": "prisma generate && next build"`
> y `"postinstall": "prisma generate"`). Vercel cachea `node_modules` y, sin esto,
> reusa un Prisma Client viejo → errores tipo *"Value 'X' not found in enum 'Role'"*
> aunque la migración ya esté aplicada en la DB. Regla: **cada cambio de schema →
> migrate deploy + redeploy** (el redeploy regenera el client).

---

## 6. Áreas en detalle

### 6.1 Compras / Catálogo (`/`)
El MVP original. Comparador de precios/stock de un SKU across proveedores.
- **Flujo:** UI (`(protected)/page.js` + `productStore` zustand) → `GET /api/products?q=`
  → `productController.getAllProducts()` que dispara en paralelo a cada
  `services/<x>API.js` (con `withTimeout` y budgets por proveedor), normaliza con
  `models/<x>Model.js`, mergea (`utils/mergeResults`) y limpia
  (`cleanMergedProduct`).
- **Cache:** cada proveedor cachea su catálogo en **Upstash Redis**; hay "warm"
  (cache caliente, rápido) vs "cold" (login + descarga real). `/api/warmup`
  precalienta.
- **Cron (Vercel):** `/api/cron/sync-{invid,airintra,microglobal,distecna}` bajan
  el catálogo completo a Redis (bloqueante, protegido con `CRON_SECRET`).
- **Proveedores integrados:** Elit, Masnet, Corcisa, Nucleo, PCArts, Invid,
  Solutionbox, AirIntra, Microglobal, Distecna (cada uno con service + model;
  credenciales en env).

### 6.2 Corpo (`/corpo/reportes-cc`)
Sube el `.xls/.xlsx` crudo del ERP (cuentas corrientes) → parsea clientes/comprobantes
→ genera un **Google Sheet** con 3 hojas (Resumen, Detalle, Dashboard) → lo guarda en
Drive (carpeta compartida) y persiste `ReporteCC`.
- Código: `lib/reportes-cc/` (`parser`, `builder-*`, `generador`, `google-client`,
  `sheets-helpers`, `notas-previas`).
- Feature notable: **arrastre de notas** — al generar un reporte nuevo, copia la
  columna "Notas" del reporte anterior matcheando por N° de cliente (cabezales) o
  N° de comprobante (detalle) (`notas-previas.js`).

### 6.3 Tiendas (`/tiendas`)
Módulo de pricing para marketplaces.
- Sube el **report21** (export del ERP con costo/stock/peso por SKU) → `Report21Row`
  + `Report21Upload`. Calcula precios de venta por tienda (ICBC, Frávega, Megatone,
  OnCity) con `lib/pricing/engine.js`, usando tablas de **fee por peso** y
  coeficientes CSI de `lib/pricing/stores.js` (defaults) o `PricingConfig` (editable
  desde `/tiendas/ajustes`).
- Sincroniza una **"planilla viva"** en Google Sheets (`sheet-sync.js`,
  `planilla.js`, usando el `.xlsx` subido como molde en Drive).
- Tiene tests: `npm test` (`node --test src/lib/pricing/*.test.js`).

### 6.4 Contabilidad (`/contabilidad/conciliacion`)  ← lo más nuevo
Sube un `.xlsx` con 4 hojas: `gbp` (recibos ERP, clave `Nro_Operacion_Limpio`) y
`argcol` / `kanji` / `ganga` (cobros MercadoPago, clave `Operación Relacionada`).
Cruza por N° de operación y genera un Google Sheet con 4 solapas: **Resumen**,
**Cobradas** (GBP en MP), **Pendientes** (GBP sin MP), **MP sin GBP**.
- Código: `lib/conciliacion/` (`parser` con el cruce, `builder`, `generador`).
  Reutiliza `google-client` y `sheets-helpers` de `reportes-cc`.
- Persiste `ConciliacionMP`.

### 6.5 Admin (`/admin/users`)
Gestión de usuarios (rol, activo). Solo `ADMIN`.

---

## 7. Integraciones externas

| Servicio | Uso | Config (env) |
|---|---|---|
| **Supabase Postgres** | DB principal (Prisma) | `DATABASE_URL` (pooler 6543), `DIRECT_URL` |
| **Google (Sheets + Drive)** | Genera/guarda los Sheets de Corpo y Contabilidad | `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON de service account), `GOOGLE_DRIVE_FOLDER_ID` (carpeta destino en Shared Drive) |
| **Upstash Redis** | Cache de catálogos de proveedores | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Vercel Cron** | Sync diario de catálogos a Redis | `vercel.json` (crons) + `CRON_SECRET` |
| **Proveedores mayoristas** | Precios/stock (Compras) | credenciales por proveedor (ver §8) |
| **NextAuth** | Sesiones | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |

El cliente de Google (`lib/reportes-cc/google-client.js`) es **genérico y
reutilizable**: `crearSpreadsheet`, `compartirConLink`, `batchUpdate`,
`listarSheets`, `leerRango`, `trashearArchivo`, etc. Scopes: spreadsheets + drive.

---

## 8. Variables de entorno

`.env` (solo lo que necesita el CLI de Prisma):
```
DATABASE_URL, DIRECT_URL
```

`.env.local` (la app en dev; en Vercel se cargan en el dashboard):
```
# Core
DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, ADMIN_SEED_KEY, CRON_SECRET
# Google
GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID
# Redis
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
# GBP Web Service (ERP)
GBP_WS_ID, GBP_WS_USERNAME, GBP_WS_PASSWORD, GBP_WS_COMPANY, GBP_WS_BRANCH, GBP_WS_LANGUAGE
# Proveedores (Compras)
AIR_INTRA_USERNAME/PASSWORD/TOKEN, DISTECNA_API_KEY, INVID_USERNAME/PASSWORD,
MICROGLOBAL_URL/USUARIO/PASSWORD/CLIENTE, ELIT_USER_ID/TOKEN, NUCLEO_USER/ID/PASSWORD,
SOLUTIONBOX_URL/USERNAME/PASSWORD, PCARTS_URL/TOKEN, CORCISA_USER_ID/TOKEN,
MASNET_URL/USER_ID/TOKEN
```
> Cualquier variable nueva hay que agregarla también en **Vercel → Project → Settings → Environment Variables**.

---

## 9. Deploy y operación

- **Repo:** GitHub `santiclfriedrich/SIC_mvp`, rama `main`. Push → deploy automático en Vercel.
- **Prod:** `https://sic-mvp.vercel.app`.
- **Build:** `prisma generate && next build`. Varias APIs declaran `maxDuration`
  (30–60s) → requieren plan **Vercel Pro** (Hobby corta a 10s).
- **Cron:** definidos en `vercel.json` (sync de catálogos, 00–03 hs).
- **Cambios de DB:** editar `schema.prisma` → crear migración →
  `npx prisma migrate deploy` (aplica a Supabase) → push (redeploy regenera el client).
- **Crear usuario:** `POST /api/auth/seed-user` con `ADMIN_SEED_KEY`, o script Prisma
  directo (hash `bcryptjs`).

---

## 10. Convenciones para agregar una **nueva área** (patrón repetible)

Este es el patrón que siguen Corpo, Tiendas y Contabilidad — replicalo para lo que venga:

1. **Rol:** agregar valor al enum `Role` (migración propia `ALTER TYPE ... ADD VALUE`).
2. **Middleware:** encerrar el rol nuevo en `/<area>/*` + `/api/<area>/*`, y exigir
   ese rol (o ADMIN) en esas rutas.
3. **`seed-user`:** sumar el rol a `ROLES_VALIDOS`.
4. **Layout guard:** `app/<area>/layout.jsx` que valide rol con `getServerSession`.
5. **Páginas:** `app/<area>/page.jsx` (home/panel) + subpáginas (upload + historial +
   `[id]` de detalle). Reusá el estilo de `contabilidad/` o `corpo/`.
6. **API:** `app/api/<area>/...` con chequeo de rol en cada handler.
7. **Lib:** lógica de negocio en `lib/<area>/`. Si genera Sheets, reusá
   `lib/reportes-cc/google-client.js` y `sheets-helpers.js`.
8. **Modelos:** agregá los models a `schema.prisma` + relación en `User` + migración.
9. **Deploy:** `migrate deploy` + push (redeploy regenera el client).

---

## 11. Playbook de migración (unificar la otra app + su Supabase + el "Panel")

Objetivo declarado: traer otra app web (y su Supabase, y lo hecho en el **"Panel"**)
a Cotizarg y **unificarlas**. Recomendaciones según la arquitectura actual:

**a) Modelo de integración = "área nueva".** Lo más natural es incorporar la app
entrante como **una o más áreas** (§10): rol propio, rutas `/<area>`, APIs
`/api/<area>`, lib `/lib/<area>`, modelos Prisma. Así conviven aisladas pero
comparten auth/DB/layout.

**b) Unificar Supabase.** Hoy Cotizarg ya usa **un** proyecto Supabase (Postgres vía
Prisma). Opciones para la DB entrante:
   - **Consolidar en esta DB (recomendado):** mover/crear las tablas de la app
     entrante en este mismo Postgres. Si ya existen en otro Supabase, se pueden
     **introspectar** con `npx prisma db pull` (apuntando temporalmente a esa DB)
     para generar los modelos, revisarlos y migrarlos acá. Cuidado con **colisiones
     de nombres** (ej. si la otra app también tiene `User`/`users`) y con las
     **RLS policies** de Supabase (Prisma las ignora salvo que se usen).
   - **Mantener 2 bases:** posible pero agrega complejidad (segundo cliente/URL). En
     general no conviene si el objetivo es "unificar".

**c) Unificar auth.** Cotizarg usa NextAuth v4 + Credentials + JWT. Si la app entrante
tenía **auth de Supabase** (o su propio login), hay que decidir: (i) migrar sus
usuarios al modelo `User` de acá (rehashear/forzar reset de contraseñas) y quedarse
con NextAuth; o (ii) convivir con Supabase Auth (más trabajo). Recomendado: un solo
sistema de identidad → NextAuth, y sumar un rol para la app entrante.

**d) UI / layout.** El `Header` global y el theming Tailwind son compartidos. Si la
app entrante tiene su propio look, entra como área con su acento de color (como
Corpo=azul, Contabilidad=verde).

**e) Secrets/env.** Consolidar variables en `.env.local` (dev) y en Vercel (prod).

---

## 12. Preguntas abiertas / a definir para la migración

Estas son las incógnitas que hay que cerrar antes de arrancar la unificación
(no las asumo):

1. **¿Qué es exactamente el "Panel"?** ¿Es la app CRM-ArgColor (FastAPI + Next en
   `~/Claude/Projects/CRM-ArgColor`), o un dashboard/panel distinto? ¿Su stack?
2. **¿Cuál es la app web que se quiere migrar?** Stack (Next? otra cosa?), y si su
   backend es Node/Next o algo separado (ej. FastAPI del CRM).
3. **¿Su Supabase es un proyecto separado del de Cotizarg, o el mismo?** Esquema de
   tablas, si usa Supabase Auth, y si tiene RLS.
4. **¿Se unifica el login (usuarios/roles) o cada app mantiene el suyo?**
5. **¿Qué features del "Panel" hay que preservar** y cuáles se rehacen con el patrón
   de áreas de acá?
6. **Dominio/deploy:** ¿todo bajo `sic-mvp.vercel.app` (o dominio propio) o deploys
   separados?

> Cuando definas esto, la implementación sigue el patrón de la §10 (área nueva) y la
> §11.b para la parte de datos. El próximo paso concreto sería: (1) mapear el schema
> de la DB entrante, (2) decidir consolidación de Supabase y auth, (3) dar de alta el
> rol + área, (4) portar la lógica a `lib/<area>` y las pantallas.
