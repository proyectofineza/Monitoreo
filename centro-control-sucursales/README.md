# Centro de Control de Sucursales — FINEZA S.A.

Aplicación real (no un mockup) para gestionar el monitoreo, verificación e
incidencias de las sucursales de FINEZA S.A., con Score por sucursal,
ranking, dashboards por rol y administración completa.

- **Frontend:** React + Vite + Tailwind CSS, desplegable en Netlify.
- **Backend:** Supabase (Postgres + Auth + Row Level Security + Edge
  Functions + Realtime). No hay servidor Node propio: toda la lógica de
  negocio y seguridad vive en la base de datos.

Este documento te lleva paso a paso desde un proyecto Supabase vacío
hasta la aplicación funcionando en Netlify.

---

## 1. Estructura del repositorio

```
centro-control-app/
├── web/                        # Frontend (React + Vite + Tailwind)
│   ├── src/
│   ├── netlify.toml            # Config de build/redirects para Netlify
│   └── .env.example            # Variables de entorno del frontend
├── supabase/
│   ├── migrations/             # SQL a ejecutar en orden (0001 → 0006)
│   ├── functions/              # Edge Functions (admin-create-user, admin-set-role)
│   └── config.toml
└── scripts/
    └── seed-demo-users.mjs     # Crea los 15 usuarios demo vía Admin API
```

---

## 2. Requisitos previos

- Una cuenta en [supabase.com](https://supabase.com) (plan gratuito alcanza).
- Una cuenta en [netlify.com](https://netlify.com) (plan gratuito alcanza).
- Node.js 18+ instalado en tu máquina (para correr el script de seed de
  usuarios y, opcionalmente, probar el frontend en local).
- Opcional: la [Supabase CLI](https://supabase.com/docs/guides/cli) si
  preferís desplegar las migraciones y Edge Functions por línea de
  comandos en vez del Dashboard web. Todo lo de abajo está explicado con
  el Dashboard web, que no requiere instalar nada.

---

## 3. Crear el proyecto en Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard) →
   **New project**.
2. Elegí una organización, un nombre (ej. `centro-control-sucursales`),
   una contraseña de base de datos (guardala, no la necesitás para esta
   app pero sí para otras herramientas) y una región cercana (ej.
   `South America (São Paulo)`).
3. Esperá 1-2 minutos a que el proyecto termine de aprovisionarse.
4. Andá a **Project Settings → API** y anotá dos valores, los vas a
   necesitar más adelante:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **anon public key**
   - (Más abajo también vas a necesitar la **service_role key** de esa
     misma pantalla — solo para crear los usuarios demo desde tu
     máquina, nunca va en el frontend).

---

## 4. Ejecutar las migraciones SQL

Andá a **SQL Editor** (ícono de la izquierda) → **New query**. Vas a
correr, uno por uno y **en este orden exacto**, el contenido de cada
archivo de `supabase/migrations/`. Pegá el contenido completo del
archivo, dale **Run**, esperá el "Success" y recién ahí pasá al
siguiente:

1. `0001_schema.sql` — tablas, enums e índices.
2. `0002_rls.sql` — Row Level Security (la autorización real por rol).
3. `0003_functions.sql` — cálculo automático de Score, auditoría y
   notificaciones (funciones y triggers).
4. `0004_seed_catalog.sql` — catálogo de tipos de incidencia, las 150
   sucursales demo y los empleados demo.

**Pará acá.** Los siguientes dos archivos dependen de que ya existan
usuarios con rol `monitoreo` — eso lo hace el script de la sección 5.

5. Después de correr el script de la sección 5, volvé al SQL Editor y
   corré `0005_demo_history.sql` — genera 45 días de verificaciones e
   incidencias demo y calcula el Score inicial de las 150 sucursales.
   (Si lo corrés antes de crear los usuarios, no rompe nada: te va a
   avisar con un `NOTICE` de que no hay usuarios todavía y no va a
   insertar nada — simplemente corré la sección 5 y repetí este paso).
6. `0006_views.sql` — vistas de conveniencia que usa el frontend
   (`branch_today_check`, `branch_last_check`, `branch_score_latest`,
   `incidents_detailed`). Podés correrla en cualquier momento después
   de `0001`.

---

## 5. Crear los usuarios demo (15 usuarios, 4 roles)

Los usuarios de Supabase Auth **no se crean por SQL** — se crean con la
Admin API, usando la `service_role key`. Hay un script listo para esto.

En tu máquina (con Node.js instalado):

```bash
cd centro-control-app/scripts
npm install
SUPABASE_URL=https://TU-PROYECTO.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=TU-SERVICE-ROLE-KEY \
node seed-demo-users.mjs
```

Reemplazá `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` por los valores
de **Project Settings → API** (la service_role key, no la anon key).

Esto crea 15 usuarios, todos con la contraseña **`Demo1234!`**:

| Rol | Cantidad | Ejemplo de email |
|---|---|---|
| Admin | 1 | `aduarte@fineza.demo` |
| Monitoreo | 10 | `jperez@fineza.demo` |
| Supervisor | 2 | `mlopez@fineza.demo` |
| RRHH | 2 | `crios@fineza.demo` |

Un trigger en la base (`handle_new_user`, parte de `0001_schema.sql`)
crea automáticamente el perfil (`profiles`) de cada usuario con su rol.

Ahora sí, volvé a la sección 4 y corré `0005_demo_history.sql` seguido
de `0006_views.sql` si todavía no lo hiciste.

**Importante:** esta contraseña compartida es solo para la demo.
Cambiala (o borrá estos usuarios y creá los reales desde
Administración → Usuarios dentro de la app) antes de usar el sistema
con datos e incidencias reales.

---

## 6. Desplegar las Edge Functions (admin-create-user, admin-set-role)

Estas dos funciones son las únicas que pueden crear usuarios nuevos o
cambiar el rol/estado de un usuario existente — el frontend nunca toca
`auth.users` directamente ni tiene la service_role key.

**Con la Supabase CLI** (recomendado si ya la tenés instalada):

```bash
cd centro-control-app
supabase login
supabase link --project-ref TU-PROJECT-REF   # está en Project Settings → General
supabase functions deploy admin-create-user
supabase functions deploy admin-set-role
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles
automáticamente dentro de las Edge Functions (Supabase los inyecta
como secretos del proyecto) — no necesitás configurarlos vos.

**Sin la CLI:** en el Dashboard, andá a **Edge Functions → Create a new
function**, nombrala `admin-create-user` y pegá el contenido de
`supabase/functions/admin-create-user/index.ts` (vas a necesitar
también copiar `_shared/cors.ts` y `_shared/requireAdmin.ts` como
archivos separados en la misma función, o inlinearlos, según lo que
permita el editor del Dashboard en tu versión — si tenés problemas con
esto, instalar la CLI es más simple). Repetí para `admin-set-role`.

---

## 7. Configurar el frontend

```bash
cd centro-control-app/web
cp .env.example .env
```

Editá `.env` y completá:

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU-ANON-KEY
```

Probar en local:

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173`, iniciá sesión con cualquiera de los
usuarios demo (ej. `aduarte@fineza.demo` / `Demo1234!` para ver la vista
de Admin) y verificá que cargan las sucursales, el dashboard y el
ranking.

Para verificar que el build de producción funciona antes de desplegar:

```bash
npm run build
```

---

## 8. Desplegar en Netlify

**Opción A — desde el Dashboard de Netlify (recomendado):**

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import
   an existing project** → conectá tu repositorio Git (GitHub/GitLab/
   Bitbucket). Si todavía no subiste este código a un repositorio, creá
   uno nuevo y pusheá esta carpeta primero.
2. **Base directory:** `web`
3. **Build command:** `npm run build` (ya viene definido en
   `web/netlify.toml`)
4. **Publish directory:** `web/dist`
5. En **Site settings → Environment variables**, agregá las mismas dos
   variables que pusiste en `web/.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. **Deploy site.**

`web/netlify.toml` ya incluye la regla de redirect necesaria para que
las rutas de React Router (`/monitoreo`, `/ranking`, etc.) funcionen al
refrescar la página o entrar por URL directa, así que no hace falta
configurar nada más.

**Opción B — Netlify CLI**, si preferís no usar Git:

```bash
npm install -g netlify-cli
cd centro-control-app/web
npm run build
netlify deploy --prod --dir=dist
```

(Con esta opción tenés que cargar las variables de entorno con
`netlify env:set VITE_SUPABASE_URL ...` antes del deploy, o configurarlas
en el Dashboard de todos modos.)

---

## 9. Primer ingreso

Con el sitio ya desplegado, entrá con cualquiera de los usuarios demo
(sección 5) — todos usan la contraseña `Demo1234!`. Cada rol ve un
dashboard y un menú distintos:

- **Admin:** ve todo — dashboard ejecutivo, administración de
  sucursales/usuarios, auditoría, configuración de la fórmula de Score.
- **Supervisor:** dashboard de supervisión operativa, ranking, mapa,
  reportes.
- **Monitoreo:** solo la pantalla de Sucursales/Verificación (es quien
  hace las revisiones diarias).
- **RRHH:** dashboard de incidencias de personal.

---

## 10. Cómo funciona la seguridad (por qué es una app real, no un mockup)

- La autorización por rol **no depende de la interfaz** — está impuesta
  por Row Level Security en Postgres (`supabase/migrations/0002_rls.sql`).
  Aunque alguien manipule el frontend, la base rechaza lo que su rol no
  permite.
- Nadie puede cambiar su propio rol ni el de otro usuario por una
  consulta directa: no existe una política de `UPDATE` sobre
  `profiles` para clientes normales. Eso solo lo puede hacer la Edge
  Function `admin-set-role`, que verifica que quien llama sea Admin
  usando su JWT antes de tocar nada.
- El Score, el historial de Score, la auditoría y las notificaciones se
  calculan y escriben exclusivamente por triggers de la base (dueños de
  sus tablas, sin pasar por RLS) — un cliente no puede falsificar su
  propio Score insertando filas a mano.
- Las incidencias no se borran nunca: tienen `deleted_at` (soft
  delete) y cada cambio queda en `audit_logs`.

## 11. Ajustar la fórmula del Score sin tocar código

Desde **Administración → Configuración** (solo Admin) se puede editar
en vivo: el puntaje base, el descuento por cada nivel de gravedad, la
ventana de recurrencia (en días) y la penalización adicional por
recurrencia. Los cambios se guardan en la tabla `settings` y se aplican
a partir del próximo recálculo de Score (cada vez que se registra,
edita o elimina una incidencia, o se finaliza una verificación).

---

## 12. Problemas comunes

- **"Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY" en la consola
  del navegador:** no copiaste `.env.example` a `.env` (local) o no
  cargaste esas variables en Netlify (producción).
- **Login funciona pero no carga ninguna sucursal:** revisá que hayas
  corrido las 6 migraciones en orden y que `0004_seed_catalog.sql` haya
  insertado las 150 sucursales (`select count(*) from branches;` en el
  SQL Editor debería dar 150).
- **"No hay usuarios con rol monitoreo todavía" al correr
  `0005_demo_history.sql`:** corré primero
  `scripts/seed-demo-users.mjs` (sección 5) y volvé a correr ese
  archivo.
- **Error 403 al crear un usuario o cambiar un rol desde
  Administración → Usuarios:** las Edge Functions no están desplegadas
  todavía, o estás logueado con un usuario que no tiene rol `admin`.
- **El mapa no muestra sucursales:** confirmá que `branches.lat` y
  `branches.lng` no sean `null` (el seed de `0004` ya los completa para
  las 150 sucursales demo; si cargaste sucursales nuevas por CSV sin
  esas columnas, no van a aparecer en el mapa hasta que les cargues
  coordenadas).
