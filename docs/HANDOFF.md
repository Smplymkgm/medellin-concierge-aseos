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

### 1. Aseadora inicia y completa un aseo

1. Tab "Aseos" → tap un aseo de hoy → **"Iniciar"** (al llegar a la propiedad) → estado `Iniciado` (badge azul, visible también para el admin). "Iniciado" vive SOLO en `Todos los Aseos` (la validación de datos del master lo rechaza) y sobrevive al sync.
2. → "Completar" → wizard de 4 pasos: datos del servicio (entrada/salida), revisión, funcionamiento, fotos y videos
3. El video es requisito en el camino feliz; si la subida falla definitivamente aparecen "Reintentar subida" / "Enviar sin video" (con confirmación) para no bloquear a la aseadora
4. Tap "Enviar y completar" → optimistic UI + `gasPost({action:'completarAseo', ...})` → backend escribe cols 8/13/14-20 en `Todos los Aseos` y marca `Finalizado` en el master
5. En la card, la dirección es hyperlink a Google Maps (col J `mapsLink` de Propiedades) y hay chip "Ver propiedad" a Airbnb (col K `airbnbLink`) — el admin los llena al editar la propiedad

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

**Frontend y backend: PR a `main` y mergear.** CI hace todo:

- `app/**` / `Index.html` → `deploy-pages.yml` publica en `gh-pages` (cache-buster = SHA del commit)
- `Code.gs` / `Sync.gs` / `appsscript.json` → `deploy-appsscript.yml`: `clasp push --force` + `clasp deploy --deploymentId <pinned>` (la URL del API no cambia) + health check `runSelfTest`

### Si `CLASPRC_JSON` caduca (síntoma: deploy falla con `invalid_grant`)

Pasó el 30 jun–15 jul 2026 (dos semanas de deploys de backend fallando en silencio). Renovar:

```bash
clasp logout && clasp login   # autorizar con development@medellinconcierge.net (owner del script)
cat ~/.clasprc.json | gh secret set CLASPRC_JSON --repo Smplymkgm/medellin-concierge-aseos
gh run rerun <RUN_ID>
```

Última renovación: 15 jul 2026.

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

1. Aseadora no entra → `gasPost({action:'runSelfTest'})` desde Chrome console (el endpoint `debug` fue eliminado) — muestra hojas, row counts y si `getPersonal` devuelve usuarios
2. Si Personal sheet tiene 0 rows, correr menú "Agregar Admin a Personal" desde el editor

### El backend responde "error de conexión" / HTML en vez de JSON

Casi siempre es una **regla de validación de datos del spreadsheet** rechazando un write: la excepción NO pasa por el try/catch de `doPost` y Apps Script devuelve una página HTML de error, que rompe el `r.json()` del frontend. Columnas con validación: master col G (`Confirmada/Cancelada/Pendiente/Finalizado`), Aseos col H (`Pendiente/Iniciado/Completado/Cancelado`). Si se agrega un estado nuevo, ampliar la regla ANTES de escribir (patrón: acción one-shot como `fixEstadoValidation`).

### Probar contra producción sin tocar datos reales

Patrón usado en jul 2026: crear un aseo desechable con `{"action":"agregarAseo","propiedad":"__TEST_DIAGNOSTIC__",...}`, ejercitar la acción a probar, y limpiar con `{"action":"limpiarFilaDiagnostico"}` (borra todas las filas de esa propiedad de prueba en Aseos y master).

## Secretos / credenciales

Ninguno en el repo. Lo importante vive en `PropertiesService.getScriptProperties()`:
- `HUBSPOT_API_KEY` (opcional, para notificaciones)

OAuth scopes en `appsscript.json`:
- spreadsheets, calendar, drive, script.external_request

## Cosas que duelen y por qué

| Síntoma | Causa | Workaround |
|---|---|---|
| Frontend tarda 3-4s en TTI | Babel compila JSX en cliente cada pageload | Pendiente Sprint 1: Vite bundle |
| ~~Copy-paste manual al editor Apps Script~~ | ~~No había CI/CD~~ | Resuelto — deploy automático desde `main` |
| ~~Deploy backend fallaba con `invalid_grant`~~ | `CLASPRC_JSON` caducado | Resuelto 15 jul 2026 — ver "Cómo deployar" para renovarlo |
| ~~"Iniciado" volvía a Pendiente solo~~ | El sync (cada 6h) borraba las filas Iniciado; y `getAllAseos` las descartaba en el merge | Resuelto jul 2026 (PRs #8, #10) |
| ~~Botón Iniciar daba "error de conexión"~~ | Validación de datos en master col G rechazaba "Iniciado" (excepción → HTML, no JSON) | Resuelto jul 2026 (PR #7) — Iniciado ya no toca el master |
| ~~Video subía pero reportaba "Error de red"~~ | Stale closure: `xhr.onerror` leía el state `progress` congelado en 0 | Resuelto jul 2026 (PR #10) |
| ~~Horas entrada/salida como "Sat Dec 30 1899..."~~ | Sheets convierte "10:00" a celda-hora; se leía sin formatear | Resuelto — `horaToStr()` (PR #9) |
| Sync de 120 aseos antes tardaba 30s | setValue celda por celda | Resuelto en Fase 7 — ahora ~5s con batch writes |
| Refresh perdía sesión | localStorage no se usaba | Resuelto en Fase 4 |
| Cancelaciones se perdían | Sync hacía DELETE+INSERT | Resuelto en Fase 7 — soft-cancel |
| Multiple aseadoras completando al mismo tiempo | Race condition | Resuelto en Fase 2 — LockService |
| Form data se descartaba al completar | Frontend mandaba, backend ignoraba | Resuelto en Fase 6 — cols 14-20 |
| Historial contaba por fecha de completar | Bug que sumaba aseos al mes anterior | Resuelto — ahora cuenta por checkout |

## Reglas de la casa

- **Sin emojis en la UI** — fallan entre plataformas. Solo el icon set SVG de `app/icons.jsx` (`<Icon name="..."/>`).
- El login arranca con el campo Nombre **en blanco** (autosuggest al escribir); no precargar ningún nombre.
- Cuidado con las reglas de validación de datos del spreadsheet al introducir valores nuevos (ver "Cómo debuggear").

## Próximos pasos sugeridos

Ver `MIGRATION_ROADMAP.md`. En orden:

1. ~~Sprint 0 — clasp + GitHub Actions~~ ✅ Completado
2. Sprint 1 — Vite bundle (TTI < 1.5 s)
3. Sprint 2 — Tests baseline
4. Sprint 3+ — Migración a Postgres

Pendiente puntual: probar el upload de video end-to-end desde un teléfono real (el fix del stale closure está desplegado pero no se ejercitó con un archivo real).

## Quién sabe qué

- Mike (owner): contexto de negocio, prioridades, acceso a editor y spreadsheet
- Claude (sesiones jun–jul 2026): historia técnica del refactor de junio, features de julio (Iniciado, Ver como, maps/airbnb links, fixes de sync/validación/video) — ver los PRs #5–#10 del repo

Para tomar el proyecto: leer este doc + `CURRENT_ARCHITECTURE.md` + `MIGRATION_ROADMAP.md` en ese orden. Después abrir `Code.gs` y `app/app.jsx` para mapear la realidad.

## Contacto

- Owner: michaelmgm1249@gmail.com
