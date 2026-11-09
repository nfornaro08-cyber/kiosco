# 🥪 Kiosco del Recreo

Sistema de kiosco escolar para consultar productos, reservar pedidos por recreo y seguir su estado. Incluye cuentas de alumno, panel de administración para productos/precios/stock, API HTTP y persistencia real en SQLite.

Proyecto **Etapa 1**: catálogo + pedidos por recreo + administración + base de datos.

---

## 1. Funcionalidades

### Alumno
- Registro e inicio de sesión.
- Catálogo con búsqueda, filtro por categoría y stock en vivo.
- Carrito persistido en el navegador.
- Elección del recreo en el que retira el pedido.
- Confirmación del pedido con código único (`K-261101-7Q3F`) y total calculado en el servidor.
- Lista de pedidos propios con estado en tiempo casi real (actualización cada 20 s).
- Cancelación mientras el pedido está pendiente; el stock vuelve al kiosco.

### Administración
- Resumen del día: pedidos, pedidos en curso, recaudación y stock bajo.
- Productos: alta, edición, precio, stock, categoría, emoji, disponibilidad y borrado/archivado.
- Ajuste rápido de stock con `+` / `−`.
- Pedidos: filtros por fecha, estado y recreo; avance de estado y cancelación.
- Recreos: alta, edición, habilitación/deshabilitación y borrado.
- Categorías: alta, edición y borrado.
- Usuarios registrados.

---

## 2. Arquitectura

El navegador **nunca** accede a la base de datos. Todo pasa por la API HTTP; el backend concentra las reglas de negocio.

```
┌──────────────────────────────┐
│ Frontend (public/)           │
│ HTML + CSS + JS ES Modules   │
│ SPA con hash routing         │
└──────────────┬───────────────┘
               │ fetch /api, cookie HttpOnly
┌──────────────▼───────────────┐
│ Capa API (src/api/)          │
│ Router, guards, validación   │
│ de sesión y rol              │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│ Backend / Servicios          │
│ src/services/                │
│ Reglas: total, stock,        │
│ reservas, estados, permisos  │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│ Repositorios (src/repositories)│
│ SQL parametrizado            │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│ SQLite (data/kiosco.sqlite)  │
│ bun:sqlite, WAL, FKs         │
└──────────────────────────────┘
```

### Capas

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Frontend | `public/` | UI, ruteo, carrito, llamadas a la API |
| API | `src/api/` | Rutas REST, cookies, autorización por rol, respuestas JSON |
| Servicios | `src/services/` | Lógica de negocio y validaciones |
| Repositorios | `src/repositories/` | Consultas SQL y mapeo de filas |
| Base de datos | `src/db/` + `data/` | Esquema, seed y conexión SQLite |

### Decisiones técnicas
- **Bun** como runtime (sin `npm install`, sin dependencias externas).
- `bun:sqlite` para la base, con `PRAGMA foreign_keys = ON` y `journal_mode = WAL`.
- Dinero en **centavos enteros** (`price_cents`, `total_cents`) para evitar errores de punto flotante.
- Contraseñas con `scrypt` + salt; sesiones con token aleatorio guardado **hasheado** (SHA-256).
- Cookie de sesión `kiosco_session` `HttpOnly`, `SameSite=Lax` (y `Secure` en producción).
- El total y los precios unitarios se recalculan siempre en el servidor: el cliente no puede imponerlos.
- El stock se descuenta dentro de una transacción `BEGIN IMMEDIATE` con `UPDATE ... WHERE stock >= ?`; si falla una línea, no se reserva nada.
- Los pedidos cancelados restauran el stock una sola vez (`stock_restored`).

---

## 3. Requisitos

- **Bun 1.2+** (probado con Bun 1.4.4 en Windows).
- No hace falta Node.js, npm, Python ni base de datos externa.

### Runtime portable ya instalado

En este equipo Bun está en:

```
C:\Users\PC\bun-runtime\bun-windows-x64\bun.exe
```

Los lanzadores `start.bat` y `start.ps1` lo detectan automáticamente. Si querés usar `bun` desde cualquier terminal, agregá esa carpeta al `PATH`:

```powershell
$env:PATH = "$env:USERPROFILE\bun-runtime\bun-windows-x64;$env:PATH"
```

---

## 4. Cómo ejecutar

### Opción A: doble clic

```
start.bat
```

### Opción B: PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### Opción C: terminal con Bun en el PATH

```bash
bun run start
```

Abrí: **http://127.0.0.1:3000**

En el primer arranque se crea `data/kiosco.sqlite` y se cargan los datos iniciales.

### Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administración | `admin@kiosco.local` | `Admin1234` |
| Alumno demo | `alumno@kiosco.local` | `Alumno1234` |

> En producción cambiá estas credenciales con las variables `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` antes del primer arranque.

### Scripts

| Comando | Qué hace |
|---|---|
| `bun run start` | Inicia el servidor |
| `bun run dev` | Inicia con recarga automática (`--watch`) |
| `bun run seed` | Carga datos iniciales si la base está vacía |
| `bun run reset` | Borra los datos y vuelve a sembrar la base |
| `bun test` | Ejecuta las pruebas automatizadas |

Con el runtime portable:

```powershell
& "$env:USERPROFILE\bun-runtime\bun-windows-x64\bun.exe" run start
& "$env:USERPROFILE\bun-runtime\bun-windows-x64\bun.exe" test
```

---

## 5. Configuración

Variables de entorno opcionales:

| Variable | Default | Descripción |
|---|---|---|
| `HOST` | `127.0.0.1` | Interfaz de escucha (`0.0.0.0` para red local) |
| `PORT` | `3000` | Puerto HTTP |
| `DB_PATH` | `data/kiosco.sqlite` | Ruta del archivo SQLite |
| `KIOSCO_TZ` | `America/Argentina/Buenos_Aires` | Zona horaria para fechas de servicio y códigos |
| `SESSION_DAYS` | `7` | Duración de la sesión en días |
| `NODE_ENV` | — | `production` activa cookies `Secure` |
| `ADMIN_NAME` | `Administración` | Nombre del admin sembrado |
| `ADMIN_EMAIL` | `admin@kiosco.local` | Correo del admin sembrado |
| `ADMIN_PASSWORD` | `Admin1234` | Contraseña del admin sembrado |

Ejemplo en PowerShell:

```powershell
$env:PORT = 3001
$env:HOST = '0.0.0.0'
.\start.bat
```

---

## 6. API REST

Base: `http://127.0.0.1:3000/api`

Formato de éxito: objeto JSON con la entidad (`{ products }`, `{ order }`, etc.).
Formato de error:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "No hay stock suficiente de ...", "details": {} } }
```

Códigos usados: `201` creado, `400` validación, `401` sin sesión, `403` sin permiso, `404` no existe, `409` conflicto de negocio, `413` cuerpo demasiado grande, `429` demasiados intentos.

### Autenticación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/auth/register` | Público | Crea una cuenta de alumno e inicia sesión |
| `POST` | `/auth/login` | Público | Inicia sesión y setea la cookie |
| `POST` | `/auth/logout` | Público | Cierra la sesión y borra la cookie |
| `GET` | `/auth/me` | Público | Devuelve `{ user }` o `{ user: null }` |

### Catálogo (público)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servidor |
| `GET` | `/products` | Productos activos. Query: `search`, `categoryId`, `available=1` |
| `GET` | `/categories` | Categorías con cantidad de productos |
| `GET` | `/recreos` | Recreos habilitados |

### Pedidos (requiere sesión de alumno o admin)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/orders` | Pedidos del usuario autenticado |
| `POST` | `/orders` | Crea un pedido: `{ recreoId, items:[{productId,quantity}], notes }` |
| `GET` | `/orders/:id` | Detalle; un alumno solo ve los propios |
| `POST` | `/orders/:id/cancel` | Cancela y devuelve stock |

### Administración (requiere rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/products` | Todos los productos, incluidos inactivos (`search`) |
| `POST` | `/admin/products` | Crea producto: `{ name, description, categoryId, priceCents, stock, emoji, active }` |
| `PUT` | `/admin/products/:id` | Edita producto |
| `PATCH` | `/admin/products/:id/stock` | Ajusta stock con `{ stock }` o `{ delta }` |
| `DELETE` | `/admin/products/:id` | Borra o archiva si tiene pedidos |
| `GET` | `/admin/categories` | Lista categorías |
| `POST` | `/admin/categories` | Crea categoría: `{ name, emoji, sortOrder }` |
| `PUT` | `/admin/categories/:id` | Edita categoría |
| `DELETE` | `/admin/categories/:id` | Borra categoría (los productos quedan sin categoría) |
| `GET` | `/admin/recreos` | Lista todos los recreos |
| `POST` | `/admin/recreos` | Crea recreo: `{ name, startTime, endTime, active, sortOrder }` |
| `PUT` | `/admin/recreos/:id` | Edita o habilita/deshabilita |
| `DELETE` | `/admin/recreos/:id` | Borra o deshabilita si tiene pedidos |
| `GET` | `/admin/orders` | Pedidos. Query: `status`, `recreoId`, `date` (`YYYY-MM-DD` o `all`) |
| `PATCH` | `/admin/orders/:id/status` | Cambia estado: `{ status }` |
| `GET` | `/admin/stats` | Resumen del día, stock bajo y más vendidos |
| `GET` | `/admin/users` | Usuarios registrados |

Ejemplo con `curl`:

```bash
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"alumno@kiosco.local","password":"Alumno1234"}' \
  http://127.0.0.1:3000/api/auth/login

curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"recreoId":1,"items":[{"productId":1,"quantity":1}],"notes":"Sin sal"}' \
  http://127.0.0.1:3000/api/orders
```

---

## 7. Reglas de negocio

### Totales
- Cada producto guarda `price_cents`.
- Al crear un pedido, el servidor toma el precio actual de la base, multiplica por la cantidad y suma.
- El total enviado por el cliente se ignora.
- Cada ítem guarda una foto del precio unitario (`unit_price_cents`) y el subtotal.

### Stock
- Se valida producto activo, stock suficiente y recreo habilitado.
- La creación ocurre en una transacción: si una línea falla, no se descuenta ninguna.
- La cancelación restaura el stock una sola vez.
- Los productos con pedidos se **archivan** (`active = 0`) en lugar de borrarse.

### Estados

```
pendiente ──► preparando ──► listo ──► entregado
    │              │            │
    └──────────────┴────────────┴──► cancelado
```

- El alumno solo puede cancelar en `pendiente`.
- El admin puede cancelar en `pendiente`, `preparando` y `listo`.
- Un pedido `entregado` o `cancelado` es final.
- Transiciones inválidas devuelven `409 INVALID_TRANSITION`.

### Fechas y códigos
- `service_date` se calcula con la zona horaria configurada (`KIOSCO_TZ`).
- El código es legible: `K-AAMMDD-XXXX` (por ejemplo `K-261101-7Q3F`).
- El formato se genera en el servidor y se reintenta si colisiona.

---

## 8. Base de datos

Archivo: `data/kiosco.sqlite` (se crea automáticamente).

Tablas:

| Tabla | Contenido |
|---|---|
| `users` | Cuentas, hash de contraseña, rol |
| `sessions` | Hash del token, vencimiento |
| `categories` | Categorías del catálogo |
| `products` | Nombre, precio en centavos, stock, categoría, activo |
| `recreos` | Nombre, horario, activo |
| `orders` | Código, usuario, recreo, fecha, total, estado |
| `order_items` | Detalle con precio unitario y subtotal |

El esquema completo está en `src/db/schema.sql` y los datos iniciales en `src/db/seed.js`.

### Reiniciar la base

```bash
bun run reset
```

o:

```powershell
& "$env:USERPROFILE\bun-runtime\bun-windows-x64\bun.exe" run src/db/seed.js --force
```

---

## 9. Pruebas

```bash
bun test
```

Se ejecutan 20 pruebas contra una base SQLite **en memoria**:

- Cálculo del total en el servidor e ignorancia del total del cliente.
- Descuento de stock y agrupación de ítems repetidos.
- Rechazo por stock insuficiente sin efectos parciales.
- Productos inactivos/inexistentes y recreos inválidos.
- Restauración de stock al cancelar, una sola vez.
- Permisos de cancelación (alumno vs admin) y pedidos entregados.
- Transiciones de estado válidas e inválidas.
- Aislamiento de pedidos entre alumnos.
- CRUD de productos, categorías y recreos, incluyendo el guardado sin cambiar el nombre.

También existe una prueba de humo HTTP manual usada durante el desarrollo que recorre login, permisos, catálogo, pedidos, cancelación, estados y CRUD: **72 comprobaciones, todas aprobadas**.

---

## 10. Estructura del proyecto

```
.
├── public/
│   ├── index.html
│   ├── favicon.svg
│   ├── css/styles.css
│   └── js/
│       ├── api.js            # Cliente HTTP
│       ├── app.js            # Estado SPA, ruteo, carrito
│       ├── ui.js             # Toasts, modales, loaders
│       ├── utils.js          # Formato de dinero/fechas/estados
│       └── views/
│           ├── auth.js
│           ├── catalog.js
│           ├── orders.js
│           └── admin.js
├── src/
│   ├── server.js             # Entrada HTTP
│   ├── app.js                # Ensamblado de DB + servicios + API
│   ├── config.js
│   ├── api/
│   │   ├── index.js
│   │   ├── router.js
│   │   ├── guards.js
│   │   ├── staticFiles.js
│   │   └── routes/           # auth, catalog, orders, admin
│   ├── services/             # Reglas de negocio
│   ├── repositories/         # SQL
│   ├── db/                   # schema.sql, database.js, seed.js
│   └── lib/                  # errors, http, validation, password, tokens...
├── tests/
│   ├── orderService.test.js
│   └── adminServices.test.js
├── data/                     # SQLite (se crea al iniciar)
├── start.bat
├── start.ps1
├── package.json
└── README.md
```

---

## 11. Mapeo con la Etapa 1

| Requisito | Dónde se cumple |
|---|---|
| Los usuarios deben iniciar sesión | Login/registro con cookie HttpOnly y sesiones en SQLite |
| Cuenta admin que agrega/edita productos, precios y stock | Panel `/admin/productos` + endpoints `/api/admin/products` |
| Listar productos y precios | Catálogo público en `/api/products` y vista Catálogo |
| Registrar pedidos para un recreo | `POST /api/orders` con `recreoId` y validación de recreo activo |
| Consultar estado del pedido | `GET /api/orders` + vista Mis pedidos con timeline |
| Administrar productos/precios/stock | CRUD de productos y ajuste de stock desde el panel |
| Persistir todo en base de datos | SQLite con 7 tablas y transacciones |
| Separación frontend / backend / API / base de datos | Carpetas `public`, `src/services`, `src/api`, `src/db` |
| El frontend no accede a la base directamente | Solo usa `fetch` a `/api`; el servidor estático sirve únicamente `public/` |

---

## 12. Seguridad implementada

- Contraseñas con `scrypt` y salt aleatorio; comparación en tiempo constante.
- Tokens de sesión aleatorios de 256 bits; en la base solo se guarda su hash.
- Cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Rate limit de login: 8 intentos fallidos por IP + correo en 5 minutos (`429`).
- Validación y normalización de todas las entradas en el backend.
- Consultas SQL siempre parametrizadas.
- Autorización por rol en cada ruta de administración.
- `Content-Security-Policy`, `X-Frame-Options: DENY`, `nosniff` y `Permissions-Policy`.
- El servidor estático resuelve rutas dentro de `public/` y bloquea path traversal.
- Límite de 1 MB para cuerpos JSON.
- Los errores internos no exponen detalles al cliente.

---

## 13. Problemas comunes

| Problema | Solución |
|---|---|
| `El puerto 3000 ya está en uso` | Cerrá el otro proceso o iniciá con `set PORT=3001 && start.bat` |
| PowerShell bloquea `start.ps1` | Usá `powershell -ExecutionPolicy Bypass -File .\start.ps1` o `start.bat` |
| `No se encontro Bun` | Verificá que exista `%USERPROFILE%\bun-runtime\bun-windows-x64\bun.exe` o agregá Bun al `PATH` |
| La base quedó con datos de prueba | Ejecutá `bun run reset` |
| No se ven cambios del frontend | Recargá con `Ctrl+F5` (el servidor no cachea HTML/JS) |

---

Hecho con Bun + SQLite + JavaScript vanilla. Sin dependencias externas.
