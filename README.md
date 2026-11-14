# 🥪 Kiosco del Recreo (Recreo Express)

Sistema de kiosco escolar: los alumnos consultan productos y precios, reservan pedidos para un recreo y siguen su estado; la administración gestiona catálogo, stock y pedidos. Todo con **frontend + backend + capa API + base de datos** bien separados.

---

## 1. Arquitectura

El navegador **nunca** accede a la base de datos: solo habla con la API por HTTP (`fetch` + cookie de sesión).

```
Frontend (public/)          HTML + CSS + JS ES Modules, SPA con hash routing
        │  fetch /api, cookie HttpOnly
Capa API (src/api/)         Router, guards de sesión/rol, respuestas JSON
        │
Backend (src/services/)     Reglas: totales, stock, estados, permisos
        │
Repositorios (src/repositories/)   SQL parametrizado
        │
SQLite (data/kiosco.sqlite) bun:sqlite, WAL, foreign keys
```

**Decisiones técnicas**
- **Bun** como runtime: sin `npm install`, sin dependencias externas.
- Dinero en **centavos enteros** para evitar errores de punto flotante.
- El total y los precios se recalculan **siempre en el servidor**: el cliente no puede imponerlos.
- El stock se descuenta en una transacción con `UPDATE ... WHERE stock >= ?`; si una línea falla, no se reserva nada. Al cancelar, el stock se devuelve una sola vez (`stock_restored`).
- Contraseñas con `scrypt` + salt; sesiones con token aleatorio guardado **hasheado** (SHA-256).

---

## 2. Cómo ejecutar

Requisito: **Bun 1.2+** (`https://bun.sh`). No hace falta Node.js ni otra base de datos.

```
start.bat          (doble clic, Windows)
```
o:
```bash
bun run start
```

Abrí **http://127.0.0.1:3000**. En el primer arranque se crea `data/kiosco.sqlite` con datos iniciales.

### Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administración | `admin@kiosco.local` | `Admin1234` |
| Alumno demo | `alumno@kiosco.local` | `Alumno1234` |

### Scripts

| Comando | Qué hace |
|---|---|
| `bun run start` | Inicia el servidor |
| `bun run dev` | Inicia con recarga automática (`--watch`) |
| `bun run seed` | Carga datos iniciales si la base está vacía |
| `bun run reset` | Borra los datos y vuelve a sembrar la base |

---

## 3. Configuración (`.env`)

| Variable | Default | Descripción |
|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `3000` | Interfaz y puerto HTTP |
| `DB_PATH` | `data/kiosco.sqlite` | Ruta del archivo SQLite |
| `KIOSCO_TZ` | `America/Argentina/Buenos_Aires` | Zona horaria para las fechas de servicio |
| `SESSION_DAYS` | `7` | Duración de la sesión |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ver `.env.example` | Cuenta admin sembrada |
| `PAYMENT_ACCESS_TOKEN` | — | Token de Mercado Pago (habilita pagos online) |
| `PAYMENT_BASE_URL` | `http://127.0.0.1:3000` | URL pública para el retorno del checkout |
| `PAYMENT_WEBHOOK_SECRET` | — | Opcional. Clave secreta de webhook de Mercado Pago: si se configura, el webhook valida la firma `x-signature` y rechaza notificaciones sin firma válida |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Habilita "Ingresar con Google" |
| `GOOGLE_ALLOWED_DOMAINS` | — | Dominios de correo permitidos, ej: `sanjoserosario.com.ar` |

---

## 4. API REST

Base: `http://127.0.0.1:3000/api`. Éxito: objeto JSON con la entidad. Error:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "...", "details": {} } }
```

### Autenticación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/auth/login` | Público | Inicia sesión y setea la cookie |
| `POST` | `/auth/logout` | Público | Cierra la sesión |
| `GET` | `/auth/me` | Público | Devuelve `{ user }` o `{ user: null }` |
| `PUT` | `/auth/password` | Usuario | Cambia la contraseña |
| `GET` | `/auth/google/status` | Público | ¿Login con Google configurado? |
| `GET` | `/auth/google/start` | Público | Inicia el flujo OAuth |
| `GET` | `/auth/google/callback` | Público | Recibe el código y crea la sesión |

### Catálogo (público)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servidor |
| `GET` | `/products` | Productos activos. Query: `search`, `categoryId`, `available=1` |
| `GET` | `/categories` | Categorías con cantidad de productos |
| `GET` | `/recreos` | Recreos habilitados |

### Pedidos (requiere sesión)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/orders` | Pedidos del usuario autenticado |
| `POST` | `/orders` | Crea pedido: `{ recreoId, items:[{productId,quantity}], notes, paymentMethod }` |
| `GET` | `/orders/:id` | Detalle; un alumno solo ve los propios |
| `POST` | `/orders/:id/cancel` | Cancela y devuelve stock |
| `POST` | `/orders/:id/pay` | Crea checkout de Mercado Pago |
| `GET` | `/orders/:id/payment` | Estado del pago |
| `POST` | `/webhooks/payments` | Webhook de Mercado Pago (público; valida la firma `x-signature` si `PAYMENT_WEBHOOK_SECRET` está configurado) |

### Administración (rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET`/`POST` | `/admin/products` | Lista (incluye inactivos) / crea producto |
| `PUT`/`DELETE` | `/admin/products/:id` | Edita / borra (archiva si tiene pedidos) |
| `PATCH` | `/admin/products/:id/stock` | Ajusta stock con `{ stock }` o `{ delta }` |
| `GET`/`POST`/`PUT`/`DELETE` | `/admin/categories[...]` | CRUD de categorías |
| `GET`/`POST`/`PUT`/`DELETE` | `/admin/recreos[...]` | CRUD de recreos |
| `GET` | `/admin/orders` | Pedidos. Query: `status`, `recreoId`, `date` (`YYYY-MM-DD` o `all`) |
| `PATCH` | `/admin/orders/:id/status` | Cambia estado: `{ status }` |
| `PATCH` | `/admin/orders/:id/payment` | Marca pago manual (efectivo): `{ status }` |
| `GET` | `/admin/stats` | Resumen del día, stock bajo y más vendidos |
| `GET`/`POST` | `/admin/users` | Lista cuentas / crea cuenta con rol |
| `DELETE` | `/admin/users/:id` | Borra cuenta y sus pedidos (no la propia) |

---

## 5. Reglas de negocio

- **Totales**: el servidor toma el precio actual de la base, multiplica por cantidad y suma. Cada ítem guarda una foto del precio (`unit_price_cents`).
- **Stock**: se valida producto activo + stock suficiente + recreo habilitado, todo en una transacción.
- **Estados**: `pendiente → preparando → listo → entregado`, con `cancelado` desde cualquier estado previo (el admin también desde `listo`). El alumno solo cancela en `pendiente`. Transición inválida → `409`.
- **Identificación**: cada pedido se identifica por su número (`#${id}`) asignado por la base.
- Los productos y recreos con pedidos asociados se **archivan** en lugar de borrarse.

---

## 6. Base de datos

Archivo `data/kiosco.sqlite` (se crea solo). Tablas: `users`, `sessions`, `categories`, `products`, `recreos`, `orders`, `order_items`, `payments`. Esquema completo en `src/db/schema.sql`, datos iniciales en `src/db/seed.js`.

Reiniciar la base: `bun run reset`.

---

## 7. Estructura del proyecto

```
.
├── public/                    # Frontend (solo UI, cero SQL)
│   ├── index.html
│   ├── favicon.svg
│   ├── css/styles.css
│   └── js/
│       ├── api.js             # Cliente HTTP de la API
│       ├── app.js             # Estado SPA, ruteo, carrito
│       ├── ui.js              # Toasts, modales, loaders
│       ├── utils.js           # Formato de dinero/fechas/estados
│       └── views/             # auth, catalog, orders, admin
├── src/
│   ├── server.js              # Entrada HTTP
│   ├── app.js                 # Ensamblado de DB + servicios + API
│   ├── config.js
│   ├── api/                   # Capa API: router, guards, rutas, estáticos
│   ├── services/              # Backend: reglas de negocio
│   ├── repositories/          # SQL
│   ├── db/                    # schema.sql, database.js, seed.js
│   └── lib/                   # errors, http, validation, password, google, mercadopago...
├── data/                      # SQLite (se crea al iniciar)
├── start.bat
├── Dockerfile / railway.json  # Deploy (Railway)
└── package.json
```

---

## 8. Mapeo con el trabajo integrador

| Requisito | Dónde se cumple |
|---|---|
| Consultar productos y precios | Catálogo público (`/api/products`) |
| Registrar pedidos para un recreo y consultar estado | `POST /api/orders` + vista "Mis pedidos" con timeline |
| Administrar productos, precios y stock | Panel admin + endpoints `/api/admin/*` |
| Guardar y recuperar información en una base de datos | SQLite (`src/db/`) |
| Diferenciar frontend / backend / API | `public/`, `src/services/`, `src/api/` |
| El frontend no accede directo a la base | Solo usa `fetch` a `/api`; el servidor estático sirve únicamente `public/` |

**Etapa 2 (extras implementados)**
- **Pagos online con Mercado Pago**: checkout real (Orders API), webhook para confirmar el pago y marcado manual de pagos en efectivo.
- **Integración con Google**: login OAuth con verificación de `id_token` y restricción por dominio del colegio.

---

## 9. Seguridad

- `scrypt` + salt para contraseñas; comparación en tiempo constante.
- Tokens de sesión de 256 bits; en la base solo se guarda su hash.
- Cookie `HttpOnly`, `SameSite=Lax` (y `Secure` en producción).
- Rate limit de login: 8 intentos por IP + correo en 5 minutos (`429`).
- Validación de todas las entradas y SQL siempre parametrizado.
- Autorización por rol en cada ruta de administración.
- CSP, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy`, límite de 1 MB por cuerpo JSON.
- Webhook de pagos: valida la firma HMAC-SHA256 (`x-signature`) de Mercado Pago cuando se configura `PAYMENT_WEBHOOK_SECRET`; además, toda notificación se verifica consultando la API del proveedor antes de cambiar el estado del pago.
- El servidor estático bloquea path traversal fuera de `public/`.

---

## 10. Problemas comunes

| Problema | Solución |
|---|---|
| `El puerto 3000 ya está en uso` | Cerrá el otro proceso o: `set PORT=3001 && start.bat` |
| `No se encontro Bun` | Instalalo desde https://bun.sh o usá el runtime portable |
| La base quedó con datos de prueba | `bun run reset` |
| No se ven cambios del frontend | Recargá con `Ctrl+F5` |
