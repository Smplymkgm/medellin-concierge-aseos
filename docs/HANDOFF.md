# Handoff — Medcon Cleanings

Para alguien (humano o Claude) que tome este proyecto sin contexto previo.

## ¿Qué es?

Web app para gestionar aseos de propiedades Airbnb en Medellín. Mobile-first. Dos roles: **admin** (gestiona) y **aseadora** (ejecuta).

- Live: https://smplymkgm.github.io/medellin-concierge-aseos/
- Repo: https://github.com/smplymkgm/medellin-concierge-aseos
- Spreadsheet: ID `1iKbcU8lcr9g5IWxryOzCs73K6TiHsmT2iSPUp6O5s5Q`
- Apps Script: editor en script.google.com (acceso solo con la cuenta del owner)

## Quien usa

- 1 admin (Mike, michaelmgm1249@gmail.com), PIN `2025`
- 3 aseadoras: Ana (PIN 1234), Fernanda (5678), Claudia (9012)
- ~25 propiedades sincronizadas vía iCal Airbnb

## Repo layout

```
.
├── Code.gs                  # Backend Apps Script (API doPost + helpers)
├── Sync.gs                  # Backend Apps Script (iCal sync + Calendar sync)
├── appsscript.json          # Manifest Apps Script (en raíz para clasp)
├── Index.html               # Shell HTML que carga *.jsx vía Babel-in-browser
├── app/
│   ├── data.jsx             # TODAY, fmtCOP, helpers, placeholder data
│   ├── icons.jsx            # SVG icons
│   ├── components.jsx       # AppBar, Avatar, StatusBadge, Sheet, etc.
│   ├── sheets.jsx           # Bottom sheets (Completar, Reassign, Edit, etc.)
│   ├── calendar.jsx         # MonthCalendar
│   ├── screens-cleaner.jsx  # Hoy, Calendario, Historial
│   ├── screens-admin.jsx    # Aseos, HistorialAdmin, Propiedades, PropiedadDetail, Personal
│   ├── app.jsx              # Root App, login, ctx, tab switcher
│   └── styles.css
├── docs/                    # Este folder
└── README.md
```

## Flujos críticos

### 1. Aseadora completa un aseo

1. Tab "Aseos" → tap un aseo de hoy → "Completar"
2. Wizard de 4 pasos: revisión (6 áreas), reposición (5 ítems), funcionamiento (9 ítems), notas + video
3. Tap "Finalizar" → optimistic UI + `gasPost({action:'completarAseo', codigo, nombre, entrada, salida, revision, reposicion, funcionamiento, reporte, videoLink, notas})`
4. Backend escribe a cols 8 (estado), 13 (timestamp), 14-20 (form fields) en hoja `Todos los Aseos`. Sync a master sheet.

### 2. Admin reasigna un aseo

1. Tab "Aseos" → tap un aseo → "Reasignar" → elegir aseadora
2. Optimistic UI + `gasPost({action:'asignarAseo', codigo, aseadora})`
3. Backend escribe a col 7 (Aseadora) en `Todos los Aseos`. Notifica HubSpot si está configurado.

### 3. Admin ve historial mensual de pagos

1. Tab "Historial" → selector de mes ←→ o botón "Rango" para custom
2. Filtros: por aseadora (chip), por propiedad (chip)
3. Stats card muestra total a pagar + breakdown por aseadora
4. Filtra por **checkout** (la fecha del aseo), no por fecha de completar

### 4. Sync Airbnb

1. Trigger automático cada 6 h, o menú "Medellin Concierge → Sincronizar Airbnb"
2. Por cada propiedad activa: fetch iCal → parse VEVENTs → dedupe por (idProp, código)
3. Reescribe master sheet con confirmadas, agrega cancelaciones soft (Confirmada → Cancelada cuando desaparece del feed), preserva MANUAL-XXX rows
4. Propaga a `Todos los Aseos`: solo aseos nuevos o cambios; **nunca** degrada un Completado

## Cómo deployar cambios

### Frontend (`app/*.jsx`, `Index.html`)

Hoy: copy-paste manual al branch `gh-pages` o `git push origin main:gh-pages`.
Pendiente (Sprint 0): GitHub Action que hace bundle + push a gh-pages automáticamente.

### Backend (`Code.gs`, `Sync.gs`)

Hoy: copy-paste en el editor Apps Script → Deploy → Manage deployments → Edit → New version → Deploy.
Pendiente (Sprint 0): `clasp push` automatizado via GitHub Action.

### URL del API

`https://script.google.com/macros/s/AKfycbwcMH9Ovbh0kS1QE_8kIqhnBd3fjHqYDvRwONARydXoYj67U9Kr5wT7Nukndbpo0tNG/exec`

Si cambia (nueva versión deployed con URL diferente), actualizar `GAS_URL` en `app/app.jsx`.

## Cómo debuggear

### Problema en frontend

1. Abrir Chrome DevTools en la web
2. Console — buscar errors (Babel reportará errores de JSX en runtime)
3. Network — POST a `script.google.com/macros/...` debe responder JSON `{ok:true,data:{...}}`

### Problema en backend

1. Apps Script editor → menú lateral "Executions" → ver la última ejecución
2. Logger.log statements aparecen ahí
3. Si el `doPost` da error, revisar el "Stack trace" — suele ser un sheet no existente o un range fuera

### Problema en la sincronización iCal

1. Menú "Medellin Concierge → Sincronizar Airbnb" manual
2. Si toast dice "0 reservas sincronizadas", una iCal URL está rota — revisar columna E de hoja Propiedades
3. Si un código aparece duplicado, revisar dedupe en `Sync.gs:sincronizarCalendarios`

### Problema en login

1. Aseadora no entra → `gasPost({action:'debug'})` desde Chrome console muestra qué hojas existen y row count
2. Si Personal sheet tiene 0 rows, correr menú "Agregar Admin a Personal" o función `llenarTodo` desde editor

## Secretos / credenciales

Ninguno en el repo. Lo importante vive en `PropertiesService.getScriptProperties()`:
- `HUBSPOT_API_KEY` (opcional, para notificaciones)

OAuth scopes en `appsscript.json`:
- spreadsheets, calendar, drive, script.external_request

## Cosas que duelen y por qué

| Síntoma | Causa | Workaround |
|---|---|---|
| Frontend tarda 3-4s en TTI | Babel compila JSX en cliente cada pageload | Pendiente Sprint 1: Vite bundle |
| Hay que pegar manualmente en Apps Script editor | No hay CI/CD | Pendiente Sprint 0: clasp + GitHub Actions |
| Sync de 120 aseos antes tardaba 30s | setValue celda por celda | Resuelto en Fase 7 — ahora ~5s con batch writes |
| Refresh perdía sesión | localStorage no se usaba | Resuelto en Fase 4 |
| Cancelaciones se perdían | Sync hacía DELETE+INSERT | Resuelto en Fase 7 — soft-cancel |
| Multiple aseadoras completando al mismo tiempo | Race condition | Resuelto en Fase 2 — LockService |
| Form data se descartaba al completar | Frontend mandaba, backend ignoraba | Resuelto en Fase 6 — cols 14-20 |
| Historial contaba por fecha de completar | Bug que sumaba aseos al mes anterior | Resuelto — ahora cuenta por checkout |

## Próximos pasos sugeridos

Ver `MIGRATION_ROADMAP.md`. En orden:

1. Sprint 0 — clasp + GitHub Actions (deploy automatizado)
2. Sprint 1 — Vite bundle (TTI < 1.5 s)
3. Sprint 2 — Tests baseline
4. Sprint 3+ — Migración a Postgres

## Quién sabe qué

- Mike (owner): contexto de negocio, prioridades, acceso a editor y spreadsheet
- Claude Sonnet 4.6 (esta sesión): historia técnica del refactor de junio 2026, decisiones de diseño

Para tomar el proyecto: leer este doc + `CURRENT_ARCHITECTURE.md` + `MIGRATION_ROADMAP.md` en ese orden. Después abrir `Code.gs` y `app/app.jsx` para mapear la realidad.

## Contacto

- Owner: michaelmgm1249@gmail.com
