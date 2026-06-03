# Apps Script Reduction Plan

Objetivo: que la dependencia de Google Apps Script baje de **crítica** a **opcional**, y eventualmente a **legacy/migración asistida**.

## Por qué reducirlo

Apps Script es perfecto para automatizar un solo spreadsheet. No es perfecto para:

1. **Despliegues frecuentes** — editar y "Deploy → Manage → Edit → New version → Deploy" no escala con CI/CD
2. **Latencia** — cada `doPost` levanta un runtime nuevo; cold start 300-1500 ms
3. **Concurrency** — `LockService` global por script: si dos aseadoras completan al mismo tiempo, una espera
4. **Quotas** — 6 min/exec, 6h/día total, 30 ejecuciones simultáneas. En multi-tenant esto es un techo
5. **Testing** — no hay forma sana de correr `Code.gs` localmente; debugging via `Logger.log` y refresh
6. **Vendor lock-in** — todo el lógica de negocio vive dentro del editor de Google

## Etapas

### Etapa 0 — Ahora (junio 2026)

Apps Script hace:
- ✅ Web API (`doPost` con 18+ acciones)
- ✅ iCal sync c/6h
- ✅ Google Calendar sync c/2h
- ✅ Auto-completar c/10pm
- ✅ Drive uploads (resumable URL generator)
- ✅ HubSpot webhook
- ✅ Form responses reader

Dependencia: **100% crítica**. Si Apps Script cae, la app no funciona.

### Etapa 1 — Auto-deploy desde GitHub (Sprint 0 del roadmap)

Cambio: copy-paste al editor desaparece.

- `clasp push` y `clasp deploy` ejecutados por GitHub Action
- Cambios al repo `main` → desplegados en <2 minutos sin intervención manual
- Versiones taggeadas con el commit SHA para rollback rápido

Dependencia sigue siendo 100% pero el **dolor operativo** baja 90%.

### Etapa 2 — Frontend bundled, sin Babel-in-browser (Sprint 1)

No reduce Apps Script directamente. Hace al frontend independiente de la latencia de Apps Script en page load.

### Etapa 3 — Postgres dual-write (Sprint 3)

Apps Script escribe a sheets + postgres. Postgres queda como secondary.

Dependencia sigue 100% pero **tenemos backup** y **dashboard de divergencia**.

### Etapa 4 — Frontend lee de Postgres (Sprint 4)

`getDatos`, `getAllAseos`, `getHistorial`, `getPropiedades`, `getPersonal` ya no son llamados por la app. Apps Script los mantiene en pie por compat pero los logs muestran 0 calls.

Dependencia baja a **escritura + sync** (~60%).

### Etapa 5 — Edge worker recibe escrituras (Sprint 5)

`completarAseo`, `asignarAseo`, `moverAseo`, `agregarAseo`, CRUD propiedades, CRUD personal — todo migra a Cloudflare Worker.

Apps Script queda solo con:
- iCal sync c/6h → escribe a Postgres
- Google Calendar sync c/2h → lee de Postgres, escribe a Calendar
- Auto-completar c/10pm → escribe a Postgres
- Drive upload URL → mantener mientras storage siga en Drive

Dependencia baja a **~25%** (solo crons + Drive).

### Etapa 6 — iCal sync en Worker cron (post Sprint 5)

Cloudflare Workers tiene cron triggers. Re-implementación de `sincronizarCalendarios` en TypeScript:

```typescript
export default {
  async scheduled(_event, env) {
    const properties = await db.query.properties.findMany({ where: { active: true }});
    for (const p of properties) {
      if (!p.ical_url) continue;
      const ical = await fetch(p.ical_url).then(r => r.text());
      const reservations = parseICal(ical, p);
      await upsertReservations(db, reservations);
    }
  }
};
```

Apps Script queda en: Google Calendar bridge + Drive uploads.

Dependencia: **~10%**.

### Etapa 7 — Calendar bridge migrado (opcional)

Si en algún momento queremos eliminar Apps Script por completo:

- Google Calendar API directa desde el Worker (OAuth con service account o Workspace impersonation)
- Drive uploads — migrar a R2/S3, deprecar resumable URL endpoint

Dependencia: **0%**. Apps Script borrado del proyecto.

## Funciones que mueren (orden)

| Función | Etapa donde muere | Reemplazo |
|---|---|---|
| `getDatos`, `getPersonal`, `getPropiedades`, `getAllAseos` | 4 | Worker GET endpoints |
| `getHistorial` | 4 | Worker GET endpoint |
| `completarAseo`, `asignarAseo`, `moverAseo`, `agregarAseo` | 5 | Worker POST endpoints |
| `actualizarPersonal`, `actualizarPropiedad`, `agregarPropiedad` | 5 | Worker POST endpoints |
| `getUploadUrl`, `registrarVideo` | 5 (con Drive) o 7 (con R2) | Worker + signed URLs |
| `sincronizarCalendarios`, `sincronizarHojaAseos` | 6 | Worker cron + Postgres |
| `autoCompletarAseosPasados` | 6 | Worker cron |
| `notificarHubspot` | 6 | Worker fetch directo |
| `sincronizarGoogleCalendar` | 7 (opcional) | Worker + Google Calendar API |
| `crearHojaPropiedades`, `crearHojaAseos`, `crearHojaPersonal`, `agregarAdmin`, `limpiarHojasDuplicadas` | siempre vivas | utilidades de setup, no críticas |
| `onOpen` (menú spreadsheet) | siempre viva | nadie le hace daño |

## Backwards compatibility durante la migración

Cada etapa **NO** rompe lo anterior. Estrategia:

1. Worker exponen endpoint nuevo `/api/v1/...`
2. Apps Script mantiene `doPost` legacy intacto
3. Frontend tiene flag `USE_WORKER_API` por endpoint
4. Una vez 100% de tráfico via Worker durante 1 semana sin issues, se borra el handler de Apps Script

## Métricas para validar cada etapa

- Llamadas a `doPost` por acción / día (Apps Script execution log)
- Errors por acción
- Latencia p50/p95 por acción
- Costo de Cloudflare Workers (target: $0 hasta 100k req/día)

Dashboard sugerido: Cloudflare Analytics + un cron Worker que escribe a una tabla `api_metrics` en Postgres.
