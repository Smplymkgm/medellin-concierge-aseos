# Current Architecture — Medcon Cleanings (Junio 2026)

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
| `Todas las Reservas` | Maestra (snapshot del iCal + manuales `MANUAL-`) | Codigo, IDProp, Propiedad, Checkin, Checkout, Noches, Estado, Empleada, Precio, Notas, Acceso, CalId, NotasAdmin |
| `Todos los Aseos` | Operativa (lo que ve la app) | + Aseadora, Estado (Pendiente/Completado/Cancelado), Completado timestamp, **cols 14-20: Entrada/Salida/Revision/Reposicion/Funcionamiento/Reporte/Video** |
| `Propiedades` | Catálogo | ID, Nombre, Precio Aseo, Acceso, iCal URL, Empleada Auto, Folder Drive |
| `Personal` | Usuarios | Activa, Nombre, PIN, Email, Formulario, Carpeta, Teléfono |
| `Videos Aseos` | Audit log | Codigo, Propiedad, Aseadora, Checkout, Link, Notas, Registrado |

## Endpoints `doPost` (JSON in/out)

| `action` | Quien usa | Función |
|---|---|---|
| `login` | App login | Valida nombre+PIN |
| `getDatos` | App login (post) | Bulk fetch: personal + propiedades + aseos del rol |
| `getPersonal` | App login (pre) | Lista para dropdown de login |
| `getAseos` | (aseadora, no usado actualmente) | Próximos + historial + total |
| `getAllAseos` | Admin | Todos los aseos con filtros opcionales |
| `getHistorial` | Admin (futuro) | Filtrado server-side por mes/rango/aseadora/propiedad + payroll totals |
| `completarAseo` / `completar` | Aseadora | Marca completado y guarda form (cols 14-20) |
| `asignarAseo` | Admin | Cambia aseadora asignada |
| `moverAseo` | Admin | Mueve fecha de checkout |
| `agregarAseo` | Admin | Crea aseo manual `MAN####` |
| `getPropiedades` / `agregarPropiedad` / `actualizarPropiedad` | Admin | CRUD propiedades |
| `actualizarPersonal` | Admin | Editar PIN/email/tel de aseadora |
| `getUploadUrl` | Aseadora | Genera resumable upload URL para Drive |
| `registrarVideo` | Aseadora | Log en hoja `Videos Aseos` |
| `getFormRespuestas` | Admin | Lee respuestas del Google Form externo |
| `debug` | Diagnóstico | Lista hojas + count + sample row |

## Triggers programados (`crearTriggersAutomaticos`)

| Función | Frecuencia | Qué hace |
|---|---|---|
| `sincronizarCalendarios` | cada 6 h | Fetch de todos los iCal → master sheet → soft-cancel de removidos → propagación a hoja Aseos |
| `sincronizarGoogleCalendar` | cada 2 h | Crea/actualiza eventos en Google Calendar para aseos con aseadora asignada |
| `autoCompletarAseosPasados` | 10 PM diario | Marca como Completado los Pendientes con checkout en el pasado |

## Concurrencia

- `LockService.waitLock(10s)` en `completarAseo` y `asignarAseo`
- `LockService.waitLock(20s)` en `sincronizarCalendarios` y `sincronizarHojaAseos`

## Lo que NO está

- ❌ Build pipeline — Babel se compila en cliente cada pageload
- ❌ Tests automatizados
- ❌ CI/CD (deploy manual via copy-paste al editor Apps Script)
- ❌ Auth con tokens (PIN + nombre se mandan en cada request)
- ❌ Cache server-side (`CacheService` no se usa todavía)
- ❌ Versionado en GitHub del Apps Script (clasp no configurado)
- ❌ Notificaciones push (WhatsApp, FCM)
- ❌ Cancelación con refund por el admin desde la app
