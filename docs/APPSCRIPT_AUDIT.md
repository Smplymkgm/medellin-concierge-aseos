# Apps Script Audit — Function-by-function

Veredicto por función. Categorías:

- **STAY** — Permanece en Apps Script (Google-specific, trigger, Workspace API)
- **MOVE-SOON** — Puede salir ya; bajo riesgo, alto beneficio
- **MOVE-LATER** — Debería salir pero requiere infra previa
- **DELETE** — One-shot / debug, no aplica producción
- **THIN** — Queda como passthrough mínimo durante la transición

Fuente: `Code.gs` (1046 líneas) + `Sync.gs` (480 líneas) post-Fase 7.

## Router / infra

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `doPost` | THIN | Es el HTTP entry point único. Mientras existan handlers se queda. Cuando los handlers migren, pasa a 404 / health-check | GitHub-hosted backend con rutas |
| `doGet` | THIN | Health-check JSON. Trivial | Health-check del nuevo backend |
| `respond` | STAY (mientras `doPost` exista) | Helper de ContentService — no aplica fuera | — |
| `getSS` / `SPREADSHEET_ID` | STAY (mientras sheets sea source-of-truth) | Singleton del spreadsheet | — |
| `CONFIG` | STAY | Constantes (nombres de hojas, meses) | Mismo concepto, distinta capa |

## Auth

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `handleLogin` | MOVE-SOON | No usa nada Google-específico — solo lee hoja Personal y compara PIN. Puede correr en cualquier backend que lea la misma hoja vía Sheets API | Endpoint `/login` en backend nuevo, lee Sheets API |
| `getPersonal` | MOVE-SOON | Lectura pura de hoja Personal. Sheets API REST equivale | Cliente Sheets API o cache en backend |

## Lectura de aseos

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `handleGetAseos` | MOVE-SOON | Read-only sobre hoja Aseos | Endpoint `/aseos?nombre=X` |
| `handleGetAllAseos` | MOVE-SOON | Read-only con filtros opcionales | Endpoint `/aseos/all` |
| `handleGetHistorial` | MOVE-SOON | Read-only, ya hoy es server-side filtering | Endpoint `/historial` con query params |
| `getAllAseos` (helper) | MOVE-SOON | Helper del anterior | — |
| `getAseosPorAseadora` (helper) | MOVE-SOON | Helper del anterior | — |

## Escritura de aseos (mutaciones)

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `handleCompletarAseo` | MOVE-SOON | Escribe cols 8, 10, 13, 14-20 + sync a master. No depende de Google APIs salvo Sheets | Endpoint `POST /aseos/:codigo/completar` que escribe via Sheets API. **Conservar el handler en Apps Script como fallback** durante 2 semanas |
| `handleAsignarAseo` | MOVE-SOON | Escribe col 7 + master + opcional HubSpot | Endpoint `POST /aseos/:codigo/asignar` |
| `handleMoverAseo` | MOVE-SOON | Escribe col 5 + master | Endpoint `POST /aseos/:codigo/mover` |
| `handleAgregarAseo` | MOVE-SOON | Append a hoja Aseos | Endpoint `POST /aseos` |
| `ensureAseosFormColumns` | MOVE-SOON | Helper para cols 14-20 | Idem |
| `autoCompletarAseosPasados` | MOVE-LATER | Es un cron. Hoy corre como trigger Apps Script (cuenta del owner) | GitHub Action con schedule cron + Sheets API, o si migramos a Postgres → en el nuevo backend |

## Propiedades y Personal

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `getPropiedades` | MOVE-SOON | Lectura pura | Endpoint `/propiedades` |
| `handleGetPropiedades` | MOVE-SOON | Wrapper | — |
| `handleAgregarPropiedad` | MOVE-LATER | Lo que tiene de Google: crea Folder Drive (`crearCarpetaPropiedad`). Si separamos esa parte, el resto migra | Endpoint `POST /propiedades` llama al nuevo backend, que a su vez llama a Apps Script para crear folder Drive (legacy bridge) |
| `handleActualizarPropiedad` | MOVE-SOON | Edita cols 2-6, ningún Google-specific | Endpoint `PATCH /propiedades/:id` |
| `handleGetPersonal` | MOVE-SOON | Lectura + cálculo de ganancias | Endpoint `/personal` |
| `handleActualizarPersonal` | MOVE-SOON | Edita cols 3-7 | Endpoint `PATCH /personal/:nombre` |

## Drive

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `handleGetUploadUrl` | STAY (corto plazo) / MOVE-LATER | Genera resumable URL de Drive con el OAuth del owner. Para salir hay que cambiar storage (R2, S3, …) o usar OAuth user-flow desde el browser directamente | Mientras Drive sea el storage, queda |
| `handleRegistrarVideo` | MOVE-SOON | Solo escribe a hoja `Videos Aseos` | Endpoint `POST /videos` |
| `registrarVideoEnHoja` (helper) | MOVE-SOON | Idem | — |
| `getCarpetaRaiz` | STAY (mientras Drive sea storage) | Drive API | — |
| `crearCarpetaPropiedad` | STAY (mientras Drive sea storage) | Drive API | — |
| `actualizarFolderIdPropiedad` | STAY (mientras Drive sea storage) | Conecta col 7 de Propiedades al folder Drive | — |

## iCal sync

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `sincronizarCalendarios` | MOVE-LATER | Pull HTTP + parse + writes a sheets. Nada Google-específico salvo el sheet de destino. **Triggers cron** son lo Google-específico | GitHub Actions cron (`schedule: '0 */6 * * *'`) que ejecuta script Node con google-spreadsheet client. **Conservar el de Apps Script** como backup durante 30 días |
| `obtenerReservasDeICal` | MOVE-LATER | UrlFetchApp → fetch | — |
| `parsearICal` | MOVE-LATER | Lógica pura, JavaScript portable | Portable as-is |
| `extraer` | MOVE-LATER | Helper | — |
| `leerDatosGuardados` | MOVE-LATER | Sheets read | — |
| `configurarEncabezados` | MOVE-LATER | Format helpers para sheet | Mismo via Sheets API |
| `limpiarDatos` | MOVE-LATER | Borra filas. Sheets API equivalente | — |
| `escribirReservas` | MOVE-LATER | Writes batched | — |
| `aplicarDropdowns` | STAY (no aplicable fuera) | DataValidation es Sheets-only | Si dejamos sheet, queda |
| `sincronizarHojaAseos` | MOVE-LATER | Lectura master + writes batched a hoja Aseos | Idem |

## Google Calendar

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `sincronizarGoogleCalendar` | STAY | CalendarApp del owner — invita guests con su identidad. Es el caso clásico donde Apps Script gana | — |

## HubSpot / externos

| Función | Categoría | Razón | Reemplazo |
|---|---|---|---|
| `notificarHubspot` | MOVE-SOON | Simple HTTP POST, nada Google-specific | Endpoint del nuevo backend |
| `handleGetFormRespuestas` | MOVE-SOON | Lee otro spreadsheet | Sheets API REST en nuevo backend |

## Menu, setup, debug

| Función | Categoría | Razón |
|---|---|---|
| `onOpen` | STAY | Solo existe para el menu del Sheet |
| `agregarAdmin` | STAY | Setup one-shot, ya corrió |
| `crearTriggersAutomaticos` | STAY (mientras triggers corran en Apps Script) | Helper de setup |
| `setupInicial` / `llenarTodo` / `fixSheetNames` / `limpiarHojasDuplicadas` / `debugSheets` / `getSpreadsheetId` | STAY o DELETE eventualmente | Utilities one-shot del owner |

## Utilidades

| Función | Categoría | Razón |
|---|---|---|
| `fechaToStr`, `fechaADate`, `formatearFecha`, `getMesAnio`, `nombreDia`, `hoyStr` | MOVE-SOON | JS puro, portable as-is |

## Resumen agregado

| Categoría | Conteo aproximado |
|---|---|
| **STAY** (Google-essential) | ~15 funciones |
| **MOVE-SOON** (1ª ola, bajo riesgo) | ~18 funciones |
| **MOVE-LATER** (2ª ola, depende de infra) | ~12 funciones |
| **THIN** (passthrough durante transición) | 2 (`doPost`, `doGet`) |
| **DELETE/SETUP** | ~10 utilities one-shot |

**Conclusión:** alrededor del **70% del código actual de Apps Script** puede salir del editor sin perder funcionalidad. La parte que se queda es legítimamente Google-Workspace: Calendar, Drive uploads, triggers via owner identity.
