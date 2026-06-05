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
| B-T1 | Sin validación de rol admin en mutating endpoints | **P1** | S (30min) | Ver SECURITY_REVIEW.md. Recomendado primer sprint post-release |
| B-T2 | LockService falta en algunos mutating handlers | P1 | S | `agregarAseo`, `moverAseo`, `actualizarPropiedad`, `eliminarPropiedad`, `actualizarPersonal`, `agregarPropiedad`. Bajo riesgo (concurrency baja) pero gratis de arreglar |
| B-T3 | `aplicarDropdowns` hardcoded a 4 aseadoras | P2 | XS | Leer dinámicamente getPersonal |
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

## Total priorizado

Si se hace UN solo sprint post-release de mantenimiento:

1. **B-T1** auth role validation (1-2h) — P1
2. **B-T2** Lock en mutating handlers restantes (30min) — P1
3. **F-T3** React production build (15min) — P2
4. **D-T1** Renombrar `#0076` duplicado (5min) — P2
5. **B-T3** Aplicar dropdowns dinámicos (15min) — P2

Total: ~3h. Después el sistema está limpio para correr por meses.
