# Current Architecture — Medcon Cleanings (Julio 2026)

## Stack

| Capa | Tech | Ubicación |
|---|---|---|
| Frontend | React 18 + Babel in-browser (no build step) | `app/*.jsx`, `Index.html` |
| Hosting frontend | GitHub Pages (branch `gh-pages`) | https://smplymkgm.github.io/medellin-concierge-aseos/ |
| Backend | Google Apps Script (V8 runtime) | `Code.gs`, `Sync.gs` |
| Database | Google Sheets | Spreadsheet ID `1iKbcU8lcr9g5IWxryOzCs73K6TiHsmT2iSPUp6O5s5Q` |
| Auth | PIN de 4 dígitos contra hoja `Personal` | `handleLogin` |
| Storage media | Google Drive (carpetas por propiedad) | `getCarpetaRaiz`, resumable upload via Drive API v3 |
| Calendar | Google Calendar (default del usuario) | `sincronizarGoogleCalendar` |
| iCal source | Airbnb iCal por propiedad | Columna E de hoja `Propiedades` |
| Webhooks | HubSpot (notas al asignar) | `notificarHubspot` |
| Sesión | `localStorage` (`medcon_session_v1`) | `app/app.jsx` |

## Topología

```
┌────────────────┐    HTTPS POST JSON     ┌─────────────────────┐
│  GitHub Pages  │  ───────────────────▶  │   Apps Script Web   │
│  (index.html + │                        │   (doPost router)   │
│   *.jsx files) │  ◀───────────────────  │                     │
└────────────────┘    JSON response       └──────────┬──────────┘
                                                     │
                                ┌────────────────────┼──────────────────────┐
                                ▼                    ▼                      ▼
                       ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
                       │ Google Sheets   │  │  Google Drive    │  │ Google Calendar │
                       │ (5 hojas)       │  │ (videos por      │  │ (eventos por    │
                       │                 │  │  propiedad)      │  │  aseadora)      │
                       └─────────────────┘  └──────────────────┘  └─────────────────┘
                                ▲
                                │ trigger c/6h
                                │
                       ┌─────────────────┐
                       │ Airbnb iCal     │
                       │ (1 URL por prop)│
                       └─────────────────┘
```

## Hojas del spreadsheet

| Hoja | Rol | Cols principales |
|---|---|---|
| `Todas las Reservas` | Maestra (snapshot del iCal + manuales `MANUAL-`) | Codigo, IDProp, Propiedad, Checkin, Checkout, Noches, Estado, Empleada, Precio, Notas, Acceso, CalId, NotasAdmin. ⚠️ Col G (Estado) tiene validación de datos: solo `Confirmada/Cancelada/Pendiente/Finalizado` |
| `Todos los Aseos` | Historial + progreso (completados, iniciados, manuales) | + Aseadora, Estado, Completado timestamp, **cols 14-20: Entrada/Salida/Revision/Reposicion/Funcionamiento/Reporte/Video**. ⚠️ Col H (Estado) tiene validación de datos: `Pendiente/Iniciado/Completado/Cancelado` (ampliada jul 2026 vía `fixEstadoValidation`) |
| `Propiedades` | Catálogo | A ID, B Nombre, C Precio Aseo, D Acceso, E iCal URL(s) (varias separadas por salto de línea), F Empleada Auto, G Folder Drive, H AccesoEstructurado (JSON), I Activa, **J mapsLink, K airbnbLink** (jul 2026) |
| `Personal` | Usuarios | Activa, Nombre, PIN, Email, Formulario, Carpeta, Teléfono, Cédula(H), Banco(I), TipoCuenta(J), NúmeroCuenta(K), NombreCompleto(L) |
| `Videos Aseos` | Audit log | Codigo, Propiedad, Aseadora, Checkout, Link, Notas, Registrado |

### Estado "Iniciado" (jul 2026)

- La aseadora toca **"Iniciar"** al llegar → `iniciarAseo` escribe `Iniciado` en col H de `Todos los Aseos` (crea la fila desde el master si el pendiente solo vivía ahí).
- "Iniciado" **NO se sincroniza al master** — la validación de col G del master lo rechaza; es un sub-estado operativo que vive solo en `Todos los Aseos`. El master pasa a `Finalizado` recién al completar, como siempre.
- `getAllAseos()` conserva las filas Iniciado en el identity-merge (puntúan +50 en `_scoreAseo`, por encima del Pendiente plano del master). `sincronizarHojaAseos()` también las conserva en su limpieza.
- ⚠️ Lección aprendida: las reglas de validación de datos del spreadsheet rechazan writes del backend con una excepción que NO pasa por el try/catch de `doPost` (Apps Script devuelve HTML de error en vez de JSON → el frontend lo ve como "error de conexión"). Antes de introducir un valor nuevo de estado, revisar/ampliar la regla de la columna.

## Endpoints `doPost` (JSON in/out)

| `action` | Quien usa | Función |
|---|---|---|
| `login` | App login | Valida nombre+PIN |
| `getDatos` | App login (post) | Bulk fetch: personal + propiedades + aseos del rol |
| `getPersonal` | App login (pre) | Lista para dropdown de login |
| `getAseos` | (aseadora, no usado actualmente) | Próximos + historial + total |
| `getAllAseos` | Admin | Todos los aseos. Identity-merge (propiedad+checkout) entre `Todos los Aseos` y el master; conserva Completado/Iniciado/manuales, `_scoreAseo` decide el ganador |
| `getHistorial` | Admin (futuro) | Filtrado server-side por mes/rango/aseadora/propiedad + payroll totals |
| `completarAseo` / `completar` | Aseadora | Marca completado y guarda form (cols 14-20) |
| `iniciarAseo` | Aseadora | Marca `Iniciado` (col H de Aseos, NO toca el master). Jul 2026 |
| `asignarAseo` | Admin | Cambia aseadora asignada |
| `moverAseo` | Admin | Mueve fecha de checkout |
| `agregarAseo` | Admin | Crea aseo manual `MAN-…` |
| `getPropiedades` / `agregarPropiedad` / `actualizarPropiedad` / `eliminarPropiedad` | Admin | CRUD propiedades (incluye `mapsLink`/`airbnbLink`, cols J/K) |
| `actualizarPersonal` | Admin | Editar PIN/email/tel + datos de facturación. NO cambia el `nombre` (login key) |
| `getUploadUrl` | Aseadora | Genera resumable upload URL para Drive (crea carpeta si falta) |
| `registrarVideo` | Aseadora | Log en `Videos Aseos` + HYPERLINK en col 37 de Aseos; si no hay fileId busca por filename (rescate Safari/CORS) |
| `runSelfTest` | Diagnóstico / CI health check | 10 checks end-to-end, no muta datos |
| `fixEstadoValidation` | Mantenimiento (one-shot, ya corrido) | Amplía la validación de col H de Aseos para aceptar `Iniciado` |
| `limpiarFilaDiagnostico` | Mantenimiento | Borra filas de la propiedad de prueba `__TEST_DIAGNOSTIC__` (usada para tests contra producción sin tocar datos reales) |

## Triggers programados (`crearTriggersAutomaticos`)

| Función | Frecuencia | Qué hace |
|---|---|---|
| `sincronizarCalendarios` | cada 6 h | Fetch de todos los iCal → master sheet → soft-cancel de removidos → propagación a hoja Aseos |
| `sincronizarGoogleCalendar` | cada 2 h | Crea/actualiza eventos en Google Calendar para aseos con aseadora asignada |
| `autoCompletarAseosPasados` | 10 PM diario | Marca como Completado los Pendientes con checkout en el pasado |

## Concurrencia

- `LockService.waitLock(10s)` en `completarAseo` y `asignarAseo`
- `LockService.waitLock(20s)` en `sincronizarCalendarios` y `sincronizarHojaAseos`

## Lo que SÍ hay (julio 2026)

- ✅ CI/CD completo — `deploy-pages.yml` (Pages, cache-buster = SHA) + `deploy-appsscript.yml` (`clasp push` + deploy pinned) + `ci.yml` (valida sintaxis). Merge a `main` = deploy.
- ✅ Health check `runSelfTest` (10 checks) en cada deploy del backend
- ✅ Estado "Iniciado" end-to-end (botón Iniciar → badge → sobrevive el sync)
- ✅ Login con autosuggest de texto (campo en blanco por defecto, matching case-insensitive contra `getPersonal`)
- ✅ "Ver como <aseadora>" para el admin — impersonación solo en memoria (`viewAs` en app.jsx), nunca toca la sesión de localStorage; banner fijo con Salir
- ✅ Badge "Ingresan huéspedes" (check-in = día del aseo) para ambos roles
- ✅ Dirección clickeable a Google Maps (`mapsLink`) + chip "Ver propiedad" a Airbnb (`airbnbLink`) en la card
- ✅ Upload de video con rescate Safari/CORS (progreso en variable local, no state) + "Reintentar subida"/"Enviar sin video" tras fallo definitivo
- ✅ Estados de carga: `ctx.dataLoaded` evita empty-states prematuros; `LoadingState` (spinner + label)
- ✅ Sin emojis en la UI — solo el icon set SVG de `icons.jsx` (`<Icon name="..."/>`)

## Lo que NO está

- ❌ Build pipeline — Babel se compila en cliente cada pageload
- ❌ Tests automatizados
- ❌ Auth con tokens (PIN + nombre se mandan en cada request)
- ❌ Cache server-side (`CacheService` no se usa todavía)
- ❌ Notificaciones push (WhatsApp, FCM)
- ❌ Cancelación con refund por el admin desde la app
