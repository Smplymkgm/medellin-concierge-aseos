# Apps Script Reduction Plan

Objetivo: que Apps Script sea **solo una capa fina de integración con Google Workspace**, no el centro del sistema.

No-goal: cambiar lógica de negocio, workflows, modelo de datos, o features.

## Rol residual permitido para Apps Script

Apps Script SE QUEDA cuando:

1. **Trigger time-based con identidad del owner** — Sheets/Drive/Calendar requieren autorización en el contexto del usuario. Un cron externo necesitaría service account + OAuth flow complejo.
2. **Google Calendar bridge** — `CalendarApp.getDefaultCalendar()` con guests usa la identidad del owner para mandar invitaciones. Replicarlo desde fuera requiere domain-wide delegation o OAuth user-impersonation, mucho más infra.
3. **Drive resumable upload** — mientras Drive sea el storage, el resumable upload URL solo puede generarlo el script con OAuth del owner. La alternativa es hacer OAuth del usuario en el browser, pero eso cambia el flujo de aseadora.
4. **Menú del Spreadsheet** (`onOpen`, helpers) — UI tools para Mike, no parte de la app.
5. **Setup utilities one-shot** — `agregarAdmin`, `llenarTodo`, `fixSheetNames`, etc. Solo corren manualmente.

Todo lo demás puede salir.

## Fases de reducción

### Fase A — GitHub-first (esta sesión)

**Cambio**: el código de Apps Script vive en GitHub. Deploys son automatizados. El editor del Apps Script se vuelve **read-only** desde el flujo de desarrollo.

**No reduce líneas de código en Apps Script** — pero reduce el **dolor operativo** del 100% al 0% y el **bus factor** del código backend de 1 al número de colaboradores del repo.

Ver `IMPLEMENTATION_ORDER.md` para los pasos concretos.

**Funciones afectadas**: ninguna lógicamente. Solo cambia donde se editan.

**Estado**: pendiente.

---

### Fase B — Estructura por dominio (esta sesión, opcional)

**Cambio**: `Code.gs` monolítico (~1046 líneas) se parte en archivos `00-config.gs`, `01-router.gs`, `10-auth.gs`, `20-aseos-read.gs`, `21-aseos-write.gs`, etc.

**Beneficio**: cada archivo cabe en ~150 líneas. Onboarding más rápido. Reviews más fáciles. Cero cambios de lógica.

**Funciones afectadas**: todas, físicamente. Lógica: ninguna.

**Estado**: pendiente.

---

### Fase C — Read endpoints fuera de Apps Script (futuro, no en esta sesión)

**Cambio**: las funciones de **solo lectura** se reescriben como un cliente directo del Google Sheets API REST, corriendo en cualquier runtime (Node en GitHub Pages no es viable; opciones: Cloudflare Worker, Vercel Function, AWS Lambda).

**Endpoints candidatos** (clasificación MOVE-SOON del audit):

- `getDatos`
- `getPersonal`
- `getPropiedades`
- `getAllAseos`
- `getAseos`
- `getHistorial`
- `getFormRespuestas`

**Trade-off**:
- Pro: latencia más baja, no consume quota de Apps Script, deploys aún más simples.
- Contra: requiere un OAuth service account o API key del spreadsheet. Capa nueva de infra.

**Estrategia**:
1. Frontend mantiene 2 URLs: `GAS_URL` (legacy) y `READ_API_URL` (nueva).
2. Feature flag `USE_NEW_READ_API` por endpoint.
3. Verificar 1 semana de paridad de resultados antes de cutover por endpoint.
4. Una vez 100% via nueva API por 30 días, borrar handlers en Apps Script.

**Funciones afectadas**: 7 endpoints de lectura.

**Estado**: futuro.

---

### Fase D — Write endpoints fuera de Apps Script (futuro)

**Cambio**: las mutaciones (con `LockService`) se reescriben usando Sheets API REST + locks externos (Redis si se necesita, o DB transactions si se migra a Postgres).

**Endpoints candidatos**:

- `completarAseo`
- `asignarAseo`
- `moverAseo`
- `agregarAseo`
- `agregarPropiedad`
- `actualizarPropiedad`
- `actualizarPersonal`
- `registrarVideo`

**Trade-off**:
- Pro: la API del backend deja de depender de Apps Script entirely.
- Contra: necesitamos un sistema de locking externo. Bajo concurrency actual lo permite, pero hay que decidir entre Redis (más infra) o reintentos optimistas (más complejo).

**Estrategia**:
1. Reescribir cada endpoint en el nuevo backend con su lock equivalente.
2. Dual-write durante 1 semana: cada mutación escribe a sheets dos veces (una via Apps Script, otra via nuevo backend) y se compara post-hoc.
3. Cutover gradual con feature flag.

**Funciones afectadas**: 8 endpoints de escritura.

**Estado**: futuro.

---

### Fase E — Crons fuera de Apps Script (futuro)

**Cambio**: los triggers time-based pasan a GitHub Actions cron o Cloudflare Worker cron.

**Funciones candidatas**:

- `sincronizarCalendarios` (cada 6h)
- `sincronizarHojaAseos` (llamado al final de la anterior)
- `autoCompletarAseosPasados` (10pm diario)

**Funciones que NO pueden salir fácilmente** (necesitan owner identity):

- `sincronizarGoogleCalendar` — usa `CalendarApp.getDefaultCalendar()` para mandar invitaciones como el owner. Replicar requiere service account con domain-wide delegation (workspace admin) o OAuth user flow.

**Trade-off**:
- Pro: independencia del quota de Apps Script (6 min/exec, 6h/día).
- Contra: para Sheets API necesitamos service account con permisos al spreadsheet.

**Funciones afectadas**: 3 triggers (de 4).

**Estado**: futuro.

---

### Fase F — Drive bridge (futuro, opcional)

**Cambio**: si en algún momento se migra storage a R2/S3, `handleGetUploadUrl` y `handleRegistrarVideo` se eliminan completamente.

**Funciones afectadas**: 2 endpoints + `crearCarpetaPropiedad`, `actualizarFolderIdPropiedad`, `getCarpetaRaiz`.

**Estado**: muy futuro. Mientras Drive funcione, no hay urgencia.

---

## Conteo proyectado de líneas de Apps Script por fase

| Fase | Después | Reducción |
|---|---|---|
| Hoy | ~1526 (Code.gs + Sync.gs) | 0% |
| A — GitHub-first | ~1526 | 0% (cero cambio de líneas, 100% cambio operativo) |
| B — Split por dominio | ~1526 (en 12+ archivos) | 0% |
| C — Read endpoints fuera | ~1100 | -28% |
| D — Write endpoints fuera | ~600 | -60% |
| E — Crons fuera (excepto Calendar bridge) | ~350 | -77% |
| F — Drive bridge eliminado | ~200 | -87% |

Estado final (~200 líneas): `onOpen`, `sincronizarGoogleCalendar`, helpers, setup one-shots. Apps Script es legítimamente Workspace-only.

## Funciones que sobreviven hasta el final

| Función | Por qué se queda |
|---|---|
| `onOpen` | Menú del Sheet |
| `sincronizarGoogleCalendar` | Owner identity para invitar a aseadoras |
| `agregarAdmin`, `crearTriggersAutomaticos`, `llenarTodo`, `fixSheetNames`, `limpiarHojasDuplicadas`, `debugSheets`, `getSpreadsheetId` | Setup utilities |
| `getSS`, `CONFIG`, fecha utils | Helpers de los anteriores |

Total: ~10 funciones esenciales.

## Métricas para validar el progreso

1. **Líneas de código en Apps Script**: tracked por commit
2. **Calls al `doPost` Apps Script** / día (logs del editor): debería caer monotónicamente
3. **Latencia p95 por endpoint**: debería bajar después de Fase C
4. **Bus factor del backend de código**: medido por accesos al repo (target: 2+)
5. **Bus factor de runtime**: medido por dependencia de la cuenta del owner (target final: solo Calendar y setup)

## No-progreso aceptable

Es OK quedarse en Fase A+B para siempre. Eso ya cumple:

- ✅ GitHub es el centro
- ✅ Deploys automatizados
- ✅ Apps Script es mantenible y versionado
- ✅ Cero dependencia del editor para cambios

Fases C-F son optimizaciones. No son requisitos para considerar el sistema "moderno".
