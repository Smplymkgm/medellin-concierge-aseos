# Migration Roadmap — Sheets → Postgres + SaaS

Plan por sprints. Cada sprint tiene exit criteria verificables. No empezamos un sprint hasta que el anterior pasó QA.

---

## Estado actual (baseline)

✅ Fases 1-7 completas:
- Backend consolidado, batch writes, locks, soft-cancel iCal
- Frontend con sesión persistente, filtros, historial por checkout
- Code.gs como single source of truth (con limpiarHojasDuplicadas)

Pending: Fases 8 (clasp), 9 (UX polish), 10 (QA + docs).

---

## Sprint 0 — Infra base (1 semana)

**Objetivo:** dejar de depender del editor de Apps Script para deploys.

- [ ] Configurar `clasp` con OAuth credentials del owner
- [ ] `.clasp.json` checked in (sin token)
- [ ] GitHub Action: en push a `main`, `clasp push` y `clasp deploy` con `--versionDescription "${commit_sha}"`
- [ ] GitHub Action: en push a `main`, build de `app/` (cuando tengamos Vite) y deploy a `gh-pages`
- [ ] README con flow nuevo (`git push` y todo lo demás se hace solo)

**Exit:** un commit cualquiera al repo aparece desplegado en producción sin tocar el editor.

---

## Sprint 1 — Build pipeline frontend (1 semana)

**Objetivo:** salir del Babel-in-browser.

- [ ] Adoptar Vite con React preset
- [ ] Migrar `app/*.jsx` a módulos ES (import/export) en lugar de globals via `Object.assign(window, ...)`
- [ ] `npm run build` produce `dist/` que va a gh-pages
- [ ] TTI debe bajar de ~4 s a <1.5 s
- [ ] Mantener cache buster removido (Vite hace hashing del bundle)

**Exit:** Lighthouse mobile score >85, no errors de consola.

---

## Sprint 2 — Tests baseline (1 semana)

**Objetivo:** poder refactorizar sin miedo.

- [ ] Vitest configurado
- [ ] Tests unitarios de `filterByPeriod`, `aseoEnriched`, `transformAseos`, `parseDateStr`
- [ ] Tests E2E con Playwright para login + completar + reasignar
- [ ] Apps Script: smoke-test script que llama cada endpoint con bogus payload y valida shape

**Exit:** suite verde en GitHub Actions, cobertura >40% en `app/`.

---

## Sprint 3 — Schema Postgres + dual-write (2 semanas)

**Objetivo:** Postgres recibe escrituras pero sheets sigue siendo source of truth.

- [ ] Crear proyecto Neon (tier gratis para empezar)
- [ ] Schema de `DATABASE_DESIGN.md` aplicado vía migración
- [ ] Tenant `medcon` insertado
- [ ] Apps Script: nueva función `exportInicial()` que migra Propiedades, Personal, Reservas, Aseos, Videos al schema postgres via REST proxy (Neon HTTP driver)
- [ ] Cada `handleX` que muta sheet añade un `dualWritePostgres(...)` después de la escritura local (NO falla la request si postgres falla, solo log)
- [ ] Dashboard de comparación: query a postgres + query a sheet, diffs en log

**Exit:** durante 1 semana en producción, dual-write con 0 divergencias detectadas en el dashboard de comparación.

---

## Sprint 4 — Read path desde Postgres (1-2 semanas)

**Objetivo:** la app lee de Postgres, ya no de sheets.

- [ ] Edge worker (Cloudflare Worker) que expone API REST sobre Postgres con JWT
- [ ] Endpoints inicialmente: `GET /aseos`, `GET /historial`, `GET /propiedades`, `GET /personal`
- [ ] Frontend con feature flag `READ_FROM_POSTGRES` que apunta a la nueva API
- [ ] Mismo shape de respuesta que `getDatos` actual (para no romper UI)
- [ ] Apps Script sigue escribiendo a ambos lados

**Exit:** durante 1 semana en producción, sheets es read-only para la app. Sheets sigue como backup.

---

## Sprint 5 — Write path migrado (2 semanas)

**Objetivo:** Postgres es source of truth. Sheet pasa a snapshot opcional.

- [ ] Edge worker recibe `POST /cleanings/:id/complete`, `/assign`, `/move`, etc.
- [ ] Apps Script ya no recibe los POST de la app — solo sigue corriendo el iCal sync, escribe a Postgres directamente
- [ ] Hojas se vuelven dump diario (read-only mirror) o se eliminan

**Exit:** Apps Script no recibe ninguna llamada de la app durante 1 semana.

---

## Sprint 6 — Multi-tenant (2 semanas)

**Objetivo:** preparar para clientes 2, 3, N.

- [ ] Onboarding flow: admin crea tenant, adds properties por iCal URL, invita aseadoras
- [ ] Billing (Stripe) por tenant — plan free hasta X aseos/mes
- [ ] Custom subdomain por tenant
- [ ] Documentación pública en `docs.medcon.app`

**Exit:** un segundo tenant piloto activo.

---

## Sprint 7+ — Crecimiento

Roadmap abierto: WhatsApp notifications, PWA push, mobile app nativa, reportes BI, etc. Priorización por feedback de tenants.

---

## Rollback criteria por sprint

| Sprint | Si pasa esto, rollback |
|---|---|
| 0 | clasp deploy falla 2 días seguidos | volver a copy-paste, investigar antes de retry |
| 1 | Lighthouse cae debajo de 70 | revertir bundle, mantener Babel mientras se debug |
| 2 | suite tarda >5min | reducir paralelismo o cortar tests |
| 3 | dual-write diverge >1% requests | pause feature flag, investigar antes de promover |
| 4 | Postgres p99 latency >1 s | sheets como fallback con feature flag |
| 5 | Postgres-only causa errors >0.1% | volver a dual-write |
| 6 | Tenants reportan data leak entre orgs | inmediato rollback, audit RLS policies |

---

## Cuestiones abiertas (a resolver antes de cada sprint)

- ¿Quién paga Neon/Supabase + Cloudflare Workers? (estimado $0-25/mes en MVP)
- ¿Mantenemos Google Drive para videos o migramos a R2 desde sprint 1?
- ¿OAuth Google para admins, o mantenemos PIN para todos?
- ¿Versiones móviles nativas o stay PWA?
