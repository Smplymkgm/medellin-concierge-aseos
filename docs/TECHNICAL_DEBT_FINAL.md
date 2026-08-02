# Technical Debt — Final State Post-Audit

Snapshot del 5 jun 2026, después de aplicar los fixes seguros del production audit.

## Deuda eliminada en la auditoría

- ✅ 10 endpoints debug/run*/inspect* removidos de doPost
- ✅ 5 funciones one-shot de bootstrap removidas de Code.gs
- ✅ TodosScreen huérfano removido
- ✅ uploads/ legacy removido
- ✅ 839 líneas eliminadas en total

## Deuda restante

### Frontend

| # | Item | Sev | Esfuerzo | Comentario |
|---|---|---|---|---|
| F-T1 | Babel-in-browser, no bundler | P2 | L (1 sem) | TTI ~4s. Adoptar Vite → bundle → TTI <1.5s |
| F-T2 | Globals via `Object.assign(window, ...)` | P3 | M | Migrar a módulos ESM cuando se adopte Vite |
| F-T3 | React 18 development build en prod | P2 | S | Cambiar `react.development.js` → `react.production.min.js` en Index.html. Cuidado con integrity hash |
| F-T4 | No useMemo en sortAseos/groupByDay/aseoEnriched | P3 | S | Solo afecta sets >500 aseos. Hoy 120 → invisible |
| F-T5 | No skeleton loaders durante getDatos | P3 | S | Mejoraría UX el primer login (~1-2s en blanco) |
| F-T6 | confirm() nativo para archivar propiedad | P3 | S | Migrar a Sheet de la app |
| F-T7 | localStorage session sin TTL | P3 | S | Agregar `exp: now + 30d` |
| F-T8 | Error boundary sin logging remoto | P3 | M | Mandar a Sentry/equiv si llega ese día |
| F-T9 | Refresh button: tap rápido sin disable visible | P3 | XS | Ya está `disabled` + spinner, cosmético |

### Backend (Apps Script)

| # | Item | Sev | Esfuerzo | Comentario |
|---|---|---|---|---|
| B-T1 | ~~Sin validación de rol admin en mutating endpoints~~ | **P1** | S (30min) | ✅ Resuelto ago 2026 — pero solo para los 5 endpoints de mantenimiento (`runSelfTest`, `fixEstadoValidation`, `limpiarFilaDiagnostico`, `repararPreciosAseos`, `repararIdsPropiedad`), vía `esAdminValido`. Los mutating endpoints normales (`asignarAseo`, `completarAseo`, etc.) siguen sin validar rol — ver B-T13 |
| B-T2 | LockService falta en algunos mutating handlers | P1 | S | Parcialmente resuelto ago 2026 (`sincronizarGoogleCalendar` en Sync.gs). Siguen sin lock en Code.gs: `handleAgregarPropiedad`, `handleActualizarPropiedad`, `handleActualizarPersonal`, `_repararIdsPropiedadCore`, `handleRegistrarVideo`/`registrarVideoEnHoja`, `actualizarFolderIdPropiedad`, `actualizarVideoEnAseo`, `handleRepararPreciosAseos` — ver auditoría ago 2026 abajo |
| B-T3 | ~~`aplicarDropdowns` hardcoded a 4 aseadoras~~ | P2 | XS | ✅ Resuelto ago 2026 — `listaAseadorasValidas()` lee dinámicamente `getPersonal()`, refrescada en ambas hojas (master + "Todos los Aseos") al agregar una aseadora nueva, sin esperar al sync |
| B-T4 | `handleGetFormRespuestas` con SHEET_ID hardcoded, frontend no lo usa | P3 | S | Considerar eliminar el handler completo |
| B-T5 | Code.gs 2199 líneas — monolítico | P2 | M | Partir por dominio (auth, aseos-read, aseos-write, propiedades, personal, drive, notificaciones, cron, setup). Beneficio cosmético/mantenibilidad |
| B-T6 | No CacheService para reads frecuentes | P3 | S | `getPropiedades` y `getPersonal` se leen en cada getDatos. Cache de 60s reduciría reads |
| B-T7 | MAN-NNNN con riesgo de colisión concurrente | P3 | XS | Cambiar a `MAN-${Utilities.getUuid().slice(0,6)}` |
| B-T8 | `Sync.gs` LockService 20s; alguna combinación puede timeout | P3 | XS | Aumentar a 30s o 60s. Bajo riesgo |
| B-T9 | `notificarHubspot` API key sin documentar dónde se configura | P3 | XS | Una línea en HANDOFF |
| B-T10 | `crearTriggersAutomaticos` borra TODOS los triggers | P3 | S | Detectar y preservar triggers manuales |
| B-T11 | Drive sharing falla silenciosamente | P3 | XS | Log warn si falla por quota |
| B-T12 | autoCompletarAseosPasados no manda email a admin con lista | P3 | S | Reportar al admin qué aseos cerró auto |

### Infra / DevOps

| # | Item | Sev | Esfuerzo | Comentario |
|---|---|---|---|---|
| I-T1 | clasp token caduca eventualmente (R2 documentado) | P2 | XS | Documentado en RISK_ANALYSIS. Cuando pase: `clasp login` + `gh secret set CLASPRC_JSON` |
| I-T2 | No hay tests automatizados | P2 | L | Vitest + Playwright. Out of scope este sprint |
| I-T3 | Lighthouse CI no integrado | P3 | M | Post Vite |
| I-T4 | Sin alerting / monitoring runtime | P3 | M | Apps Script execution logs en console.cloud.google si lo activas |
| I-T5 | gh-pages branch acumula commits | P3 | XS | Aceptable indefinidamente |
| I-T6 | Sin staging environment | P3 | M | Otro Apps Script + branch `staging` |
| I-T7 | dependabot.yml monthly | P3 | XS | Apropiado |

### Datos / Spreadsheet

| # | Item | Sev | Esfuerzo | Comentario |
|---|---|---|---|---|
| D-T1 | ID duplicado `#0076` en Propiedades | P2 | XS | Renombrar uno a `#0076b` manualmente |
| D-T2 | Acceso (col D) y Estructurado (col H) coexisten | P3 | M | Convergir cuando se editen todas las props desde la app |
| D-T3 | PINs en plain text col C | P2 | M | bcrypt + migración. Out of scope |
| D-T4 | Sin índices — scan lineal de aseos | P3 | M | A 5000+ filas se notaría |
| D-T5 | Col I "Activa" recién creada — propiedades viejas pueden no tenerla | P3 | XS | `getPropiedades` trata empty como TRUE → backward-compat ✓ |
| D-T6 | Mes (Check-out) col 38 puede quedar desactualizada si edits manuales | P3 | XS | Re-correr menu "Activar filtro" |

## Auditoría ago 2026 — hallazgos nuevos, no cubiertos en jun 2026

Auditoría completa línea por línea (Code.gs 3156 líneas, Sync.gs 664, app/*.jsx ~3300). Informe completo entregado al owner; acá solo lo que queda pendiente después de los fixes de la sesión de ago 2026.

### Resuelto en la sesión de ago 2026

- ✅ Endpoints de mantenimiento sin auth (B-T1 parcial, ver arriba)
- ✅ Race condition `sincronizarGoogleCalendar` sin lock vs. `sincronizarCalendarios` (B-T2 parcial) + `cal.createEvent()` sin try/catch abortaba el loop
- ✅ `runSelfTest` con check roto permanente (exigía trigger `autoCompletarAseosPasados`, deshabilitado a propósito)
- ✅ Sync de iCal secuencial → `UrlFetchApp.fetchAll()` en lotes de 50 (techo de escala ~200-400 propiedades antes de esto)
- ✅ Dropdown de aseadora hardcoded en DOS hojas (master H y "Todos los Aseos" G — el segundo no estaba cubierto por el fix de B-T3 original)
- ✅ "Agregar aseadora" no persistía en backend (bug de UI, no de deuda técnica — pero bloqueaba el flujo de asignación)
- ✅ Rename de código de propiedad sin cascade a reservas/aseos existentes (huérfanos)
- ✅ Desasignar aseo se revertía solo en el siguiente sync
- ✅ Frontend: timeout+reintentos en `gasPost`, auto-actualización de versión, refresh en background entre sesiones

### Pendiente

| # | Item | Sev | Esfuerzo | Comentario |
|---|---|---|---|---|
| B-T13 | Mutating endpoints normales (`asignarAseo`, `completarAseo`, `agregarPropiedad`, etc.) sin validar rol/sesión | P2 | M | Distinto de B-T1 — esos ya no importan tanto porque requieren conocer códigos de aseo/propiedad válidos, pero conviene revisar antes de escalar a más usuarios |
| B-T14 | Escrituras celda-por-celda en ~10 funciones (`handleCompletarAseo`, `handleActualizarPropiedad`, `handleActualizarPersonal`, `normalizarEstadosCancelados`, etc.) en vez de batch `setValues()` | P3 | M | No urgente a 40 propiedades; se nota en operaciones bulk sobre todo el histórico |
| B-T15 | Lecturas redundantes dentro de un mismo request (`getDatos` hace ~4 lecturas completas de hoja; `handleAsignarAseo` hasta 3; `_repararIdsPropiedadCore` lee Propiedades 2 veces) | P3 | S-M | Candidato directo para B-T6 (CacheService) — resolvería varios de estos de una |
| B-T16 | `getAllAseos` (135 líneas) y `handleCompletarAseo` (129 líneas) mezclan responsabilidades | P3 | M | Dividir en funciones más chicas, sin cambiar comportamiento |
| B-T17 | `_scoreAseo()` y el `score()` inline de `eliminarAseosDuplicados` implementan el mismo heurístico duplicado | P3 | XS | Extraer a una sola función compartida |
| F-T10 | Estado global `LIVE_PROPS`/`LIVE_PERSONAL` (data.jsx) sincronizado a mano con React state en cada call site | P3 | M | Riesgo real ya encontrado: rollback de `doSaveCleaner` usa closure en vez de snapshot `prev`, inconsistente con el resto |
| F-T11 | `CompletarSheet` (~330 líneas) y `AseoCard` (~228 líneas) son los componentes más grandes y con más responsabilidades mezcladas del frontend | P3 | M | Dividir en subcomponentes/hooks cuando se toque ese código de nuevo |

## Total priorizado

Si se hace UN solo sprint post-release de mantenimiento:

1. ~~**B-T1** auth role validation (1-2h) — P1~~ ✅ (parcial, ago 2026 — falta B-T13)
2. ~~**B-T2** Lock en mutating handlers restantes (30min) — P1~~ ✅ (parcial, ago 2026 — falta el resto en Code.gs)
3. **F-T3** React production build (15min) — P2
4. **D-T1** Renombrar `#0076` duplicado (5min) — P2
5. ~~**B-T3** Aplicar dropdowns dinámicos (15min) — P2~~ ✅ Resuelto ago 2026
6. **B-T15** CacheService para `getPropiedades`/`getPersonal` (30min) — resolvería varias lecturas redundantes de una

Total restante: ~1-2h para lo que sigue pendiente de la lista original, más lo nuevo de B-T13 a B-T17 (esfuerzo medio, no urgente a 40 propiedades).
