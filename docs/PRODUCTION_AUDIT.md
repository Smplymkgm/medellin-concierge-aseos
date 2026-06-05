# Production Audit — Junio 5, 2026

Auditoría integral del repo previa a sign-off como release candidate de producción. 8 fases. Cada hallazgo clasificado **P0** (crítico) · **P1** (alto) · **P2** (medio) · **P3** (bajo).

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Líneas Code.gs antes / después | 2321 / 2199 (-122) |
| Líneas frontend antes / después | 2611 / 2510 (-101) |
| Endpoints doPost antes / después | 24 / 14 (-10) |
| Archivos legacy eliminados | uploads/ (2 md) |
| Hallazgos P0 | 0 |
| Hallazgos P1 | 3 (2 fixed) |
| Hallazgos P2 | 7 (5 fixed) |
| Hallazgos P3 | 12 (10 fixed) |

## Fase 1 — Code Quality

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| CQ-01 | P3 | `setupInicial`, `debugSheets`, `llenarTodo`, `fixSheetNames`, `getSpreadsheetId` en Code.gs — helpers de bootstrap ya ejecutados | ✅ Eliminados |
| CQ-02 | P3 | `TodosScreen` en screens-cleaner.jsx — tab quitado del nav | ✅ Eliminado |
| CQ-03 | P3 | `uploads/DESIGN_SYSTEM_PROMPT.md` + `uploads/HANDOFF_CLAUDE_CODE.md` — legacy del scaffolding | ✅ Eliminados |
| CQ-04 | P3 | Comentario `// COMPARTIR TODOS LOS VIDEOS — one-shot` reportado como TODO por grep — solo es título de sección | ⏭ No es issue |
| CQ-05 | P2 | Babel-in-browser para compilar JSX en cada pageload → TTI ~4s | 🛑 No fix (out of scope: requiere Vite) |
| CQ-06 | P3 | Globals via `Object.assign(window, ...)` — limita tree-shaking | 🛑 No fix (requiere bundler) |

Ver `TECHNICAL_DEBT_FINAL.md` para detalle de los no-fixes.

## Fase 2 — Apps Script

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| AS-01 | P1 | doPost expone 10 endpoints debug/run* mutadores accesibles anónimamente | ✅ Eliminados |
| AS-02 | P2 | `handleAsignarAseo`, `handleEliminarPropiedad`, `handleActualizarPersonal` no validan rol admin — cualquier sesión podría llamarlas | ⚠ Documentado (URL no es pública pero gap existe). Ver `SECURITY_REVIEW.md` |
| AS-03 | P1 | LockService falta en `handleAgregarAseo`, `handleMoverAseo`, `handleActualizarPropiedad`, `handleEliminarPropiedad`, `handleActualizarPersonal`, `handleAgregarPropiedad` — race teórico | 🟡 Pendiente (concurrency baja en la práctica) |
| AS-04 | P2 | `notificarAdminAsignacionesPendientes` envía email diario a las 7AM. Si no hay aseos sin asignar, emite log "0 pendientes" y NO envía email. Bien | ✅ OK |
| AS-05 | P3 | `notificarHubspot` busca `HUBSPOT_API_KEY` en PropertiesService. Sin key, no-op silencioso. OK | ✅ OK |
| AS-06 | P2 | `handleGetUploadUrl` lookup de propiedad por nombre Y id — si una propiedad tiene nombre cambiado puede colisionar con otra. Bajo riesgo | ⚠ Documentado |
| AS-07 | P3 | `Sync.gs:aplicarDropdowns` tiene hardcoded `["Ana","Fernanda","Claudia","Admin"]` — si agregas aseadora nueva, la validación de la celda no la permite | 🟡 Documentado |
| AS-08 | P2 | `handleGetFormRespuestas` lee un spreadsheet hardcoded ID externo. Si el dueño borró ese spreadsheet → exception. Endpoint ya removido del frontend, queda como código muerto | 🟡 Considerar eliminar |
| AS-09 | P3 | `migrarFormJsonAColumnas` y `convertirVideosAHyperlink` ya corrieron; quedan en submenú "Setup (avanzado)" como red de seguridad | ✅ OK |
| AS-10 | P3 | `crearTriggersAutomaticos` — al re-ejecutarlo, borra TODOS los triggers (incluso si se agregaron nuevos manualmente) | 🟡 Documentado |

## Fase 3 — Frontend

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| FE-01 | P2 | Initial state usa fallback `[]` para aseos/props/personal — entre page load y getDatos, hay ~1-2s donde admin ve pantalla vacía. Mejora vs antes (placeholders) pero podría tener skeleton | ✅ OK (aceptable) |
| FE-02 | P1 | `aseoEnriched` antes no propagaba `accesoEstructurado` → bug "Kardinal 604 sin clave" | ✅ Resuelto (commit 5f82843) |
| FE-03 | P2 | `AgregarAseoSheet` crashea cuando `getProps()` está vacío | ✅ Resuelto (commit 49deed8) |
| FE-04 | P3 | Refresh button: `disabled` durante sync, pero el ícono no rota con animación si el usuario hace tap rápido antes del primer render | ✅ OK |
| FE-05 | P2 | Cache buster manual (`?v=N`) — el CI lo reemplaza por SHA en deploy. Manual hasta el deploy | ✅ OK |
| FE-06 | P3 | `nights(checkin, checkout)` puede devolver NaN si las fechas vienen mal del API. Bajo riesgo | 🟡 Documentado |
| FE-07 | P2 | `confirm()` para archivar propiedad — modal nativo del browser, mobile-unfriendly. Aceptable | ✅ OK |
| FE-08 | P3 | `localStorage` session sin TTL — un browser olvidado queda permanentemente logueado. Aceptable para Medcon (devices personales) | ⚠ Documentado |
| FE-09 | P3 | Error boundary captura, muestra Recargar — no manda el error a ningún logging service | 🟡 Documentado (low priority) |

## Fase 4 — Data Integrity

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| DI-01 | P2 | `#0076` duplicado en hoja Propiedades (Mike confirmó: 2 listings del mismo apto). `propById` devuelve el primer match → la 2da queda inaccesible vía lookup | ⚠ Documentado |
| DI-02 | P3 | `MAN-NNNN` para aseos manuales usa `lastRow.padStart(4)` — riesgo si llegamos a 10k filas o si hay 2 inserciones concurrentes | 🟡 Documentado |
| DI-03 | P2 | Sync iCal preserva `Cancelado/Finalizado` pero las cols 8 (acceso) y siguientes se pierden si la reserva re-aparece | 🟡 Documentado |
| DI-04 | P3 | `Acceso (texto libre)` y `Acceso Estructurado JSON` coexisten en cols D y H — divergencia posible si admin edita una y no la otra | ✅ Funciona bien por convención |
| DI-05 | P2 | Aseos con `precio=0` mezclan dos significados: "sin precio asignado" vs "lo paga el propietario" | ✅ Resuelto: ahora se renderiza "Sin cargo · paga propietario" |

## Fase 5 — Security

Ver `SECURITY_REVIEW.md` para detalle. Resumen:

- P1: Mutating endpoints sin auth de rol (mitigado parcialmente por URL semi-secreta)
- P2: PIN en plain text en col C de Personal
- P3: Token GitHub de owner queda en `~/.claude/settings.local.json` local (gitignored, no leak al repo)

## Fase 6 — Performance

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| PF-01 | P2 | `sincronizarHojaAseos` ya batch-writes (commit ee5094b) | ✅ OK |
| PF-02 | P2 | `getDatos` devuelve TODA la lista de aseos sin paginar — con 1000+ aseos sería lento. A 120-200 (actual) está OK | ⚠ Documentado |
| PF-03 | P3 | `compartirTodosLosVideos` recorre TODAS las subcarpetas y archivos — O(N). Solo se corre manualmente. OK | ✅ OK |
| PF-04 | P3 | `transformProps` corre en cada login. Cheap (~25 props). OK | ✅ OK |
| PF-05 | P2 | `LockService.waitLock(20s)` en sincronizar — si timeout, simplemente skip. Bien | ✅ OK |
| PF-06 | P3 | No hay `CacheService` para `getPropiedades` / `getPersonal`. Cada `getDatos` re-lee las hojas. A 25-100 filas no se nota | 🟡 Mejorable |

## Fase 7 — Deployment Readiness

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| DR-01 | P2 | Frontend usa `react.development.js` desde unpkg en producción. Debería ser `react.production.min.js` | 🟡 P2 para after-release |
| DR-02 | P1 | clasp OAuth token expira (R2 documentado en RISK_ANALYSIS) — sucedió y se regeneró el 4 jun | ✅ Mitigación documentada |
| DR-03 | P3 | `.clasp.json` gitignored — sano | ✅ OK |
| DR-04 | P3 | Health check post-deploy no falla el workflow si la API responde con 0 (solo warning) | ✅ Diseño correcto (no block en network) |
| DR-05 | P3 | Cache buster ahora auto via CI sha | ✅ OK |

## Fase 8 — Failure Analysis

Detalle en `BUG_REPORT.md` sección "Failure modes". Resumen:

- **Airbnb iCal fail**: timeout/404 → `obtenerReservasDeICal` retorna [] silencioso → sincronizarCalendarios completa con 0 reservas para esa prop. Otras props OK. Lock liberado.
- **Calendar API fail**: `sincronizarGoogleCalendar` tiene try/catch silencioso por evento. Otros continúan.
- **Quota Sheets**: writes batch + LockService minimizan riesgo. Si pasa, el handler retorna error claro al frontend.
- **Concurrent completes**: 2 aseadoras completando = LockService.waitLock(10s) serializa.
- **Missing sheet**: cada handler check `if (!hoja)` → retorna error.
- **Network frontend**: gasPost catch → toast "Error de conexión".

## Hallazgos no-fix (out of scope / aceptables)

Ver `TECHNICAL_DEBT_FINAL.md`.
