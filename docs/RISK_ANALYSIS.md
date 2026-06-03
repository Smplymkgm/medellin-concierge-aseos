# Risk Analysis — Apps Script Reduction

Para cada cambio propuesto, qué puede romper y cómo lo mitigamos. Sin business logic changes.

## Riesgos catalogados

### R1 — Clasp deploy reemplaza el URL del Web App

**Probabilidad**: media. **Impacto**: crítico (la app deja de funcionar hasta actualizar `GAS_URL` en el frontend y re-deployar).

**Causa**: cada `clasp deploy` sin `--deploymentId` crea un deployment **nuevo**, con URL distinto.

**Mitigación**:
- El workflow `deploy-appsscript.yml` pasa `--deploymentId "${{ secrets.APPSCRIPT_DEPLOYMENT_ID }}"` que **actualiza** el deployment activo en lugar de crear uno nuevo.
- Documentado en `CICD_ROADMAP.md`.
- Adicional: agregar un health-check post-deploy que haga POST a la URL canónica y verifique respuesta `{ok:true,...}`. Si falla, marcar el deployment como inválido y restaurar.

**Plan B si pasa**: revertir manualmente el deployment desde el editor (versions previas se conservan) y actualizar `GAS_URL` en `app/app.jsx`.

---

### R2 — Secret `CLASPRC_JSON` se invalida

**Probabilidad**: media (refresh tokens de Google a veces caducan tras inactividad prolongada). **Impacto**: alto (deploys quedan rotos hasta regenerar).

**Mitigación**:
- Documentar el proceso de regeneración en `HANDOFF.md`: `clasp logout && clasp login && pbcopy < ~/.clasprc.json` → actualizar secret en GitHub.
- Health-check workflow semanal que solo hace `clasp open` (no deploy) y notifica si falla.

**Plan B**: deploy manual via copy-paste (proceso actual) durante el tiempo que tome regenerar.

---

### R3 — `clasp push --force` borra cambios hechos directamente en el editor

**Probabilidad**: alta si alguien sigue editando en el editor después de adoptar clasp. **Impacto**: alto (cambios perdidos).

**Mitigación**:
- **Convención dura**: una vez clasp está activo, el editor del Apps Script se vuelve **read-only** desde la perspectiva del flujo. Todos los cambios pasan por PR a GitHub.
- Documentar prominentemente en `HANDOFF.md` y en `README.md`.
- (Opcional) Mike puede agregar `LockedScript.scope = "FORCE_READONLY"` en `.clasp.json` — pero no existe esa flag, así que el control es por proceso.

**Plan B**: `clasp pull` antes de cada PR. Si hay diff inesperado, abrir issue y reconciliar.

---

### R4 — Mover `Code.gs`/`Sync.gs` a `apps-script/` rompe el deployment

**Probabilidad**: baja con cuidado. **Impacto**: crítico.

**Causa**: si `appsscript.json` y los `.gs` no están donde clasp los espera, el push falla o sube archivos vacíos.

**Mitigación**:
- Antes del move: `clasp pull` para verificar baseline
- Move y commit
- Actualizar `.clasp.json` rootDir
- `clasp push --force` desde local — verificar visualmente en el editor que el contenido es correcto
- Solo después push a `main` para que CI corra
- (En PR previo) crear `.claspignore` correcto

**Plan B**: revertir el move (`git revert`) y volver a copy-paste manual hasta resolver.

---

### R5 — Triggers programados se borran al re-deployar

**Probabilidad**: baja. Apps Script preserva triggers entre versiones por defecto. **Impacto**: crítico (sin sync, los aseos no se actualizan).

**Mitigación**:
- Después de cada deploy automatizado, el workflow hace una llamada a `clasp logs` para verificar que los triggers están listados.
- Health-check separado: una vez al día, GitHub Action llama al endpoint `debug` para verificar lastRows de cada hoja (si no crece la hoja en un día con reservas esperadas, alguien revisa).

**Plan B**: re-correr `crearTriggersAutomaticos` desde el menú del Sheet (5 segundos).

---

### R6 — Frontend deploy a `gh-pages` con cache buster automático causa downtime breve

**Probabilidad**: baja. **Impacto**: bajo (usuarios pueden ver pantalla en blanco por <30s mientras se sincronizan los archivos).

**Mitigación**:
- `peaceiris/actions-gh-pages@v4` con `keep_files: false` hace replace atómico al final.
- GitHub Pages CDN propaga en ~1 min.
- Cache buster nuevo (`?v=<SHA>`) garantiza que el viejo HTML no se sirve mezclado con JSX nuevos.

**Plan B**: `git revert` del último commit a `main`.

---

### R7 — Branch protection mal configurada bloquea hotfixes urgentes

**Probabilidad**: media. **Impacto**: medio (Mike no puede pushear directo a main en emergencia).

**Mitigación**:
- Configurar branch protection con `allow administrators to bypass`.
- Documentar en `HANDOFF.md` el proceso para hotfix: PR + auto-merge inmediato.

**Plan B**: temporalmente deshabilitar branch protection desde Settings.

---

### R8 — Migrar logica fuera de Apps Script introduce divergencias

**Probabilidad**: alta cuando se haga (no en este sprint). **Impacto**: alto.

**Mitigación**: cuando llegue ese momento (Sprint 4+ del `MIGRATION_ROADMAP`), usar dual-write y dashboard de comparación antes del cutover. Detallado en `MIGRATION_ROADMAP.md`.

**Esta sesión NO migra lógica fuera de Apps Script**. Solo cambia el deploy pipeline.

---

### R9 — GitHub Action consume minutos del plan free

**Probabilidad**: muy baja con este volumen de commits. **Impacto**: nulo en el plan free de GitHub para repos públicos (minutos ilimitados). En privados: 2000 min/mes.

**Mitigación**:
- Workflows están bien filtrados por `paths` — solo corren cuando los archivos relevantes cambian.
- `cancel-in-progress: true` para PR workflows evita acumulación.

---

### R10 — Drive/Calendar quotas se consumen por re-deploys frecuentes

**Probabilidad**: baja. **Impacto**: medio.

**Causa**: cada `clasp deploy` no consume quota; solo las ejecuciones (`doPost`, triggers) lo hacen. El roadmap no aumenta llamadas a Google APIs.

**Mitigación**: ninguna especial. El uso queda igual o menor que hoy.

---

## Riesgos descartados

Los listo para constancia de que se evaluaron:

- ❌ "Migrar a TypeScript". No — fuera de scope, requiere Vite, no ayuda al objetivo de reducción de Apps Script directamente.
- ❌ "Adoptar tests E2E ahora". No — sin Vite es complicado, y el CI ya tiene parse-check del Apps Script.
- ❌ "Migrar Sheets a Postgres". No — el usuario explícitamente pidió no redesignar datos.

---

## Resumen tabla

| ID | Riesgo | P | I | Score | Estado mitigación |
|----|---|---|---|---|---|
| R1 | Deploy URL cambia | M | A | 6 | ✅ pin deploymentId |
| R2 | Token expira | M | A | 6 | ✅ proceso regen documentado |
| R3 | Edits en editor se pierden | A | A | 9 | ⚠️ control por convención (más débil) |
| R4 | Move de archivos rompe deploy | B | A | 3 | ✅ checklist pre-move |
| R5 | Triggers se borran | B | A | 3 | ✅ verificación post-deploy |
| R6 | Pages downtime | B | B | 1 | ✅ keep_files false |
| R7 | Branch protection bloquea hotfix | M | M | 4 | ✅ allow admin bypass |
| R8 | Divergencia lógica futura | — | — | — | Fuera de scope |
| R9 | Quota CI | B | C | 1 | ✅ paths filter |
| R10 | Google quotas | B | M | 2 | Sin cambio en uso |

**Score = P × I** (Bajo=1, Medio=2, Alto=3).

**Riesgo más alto sin mitigación dura: R3 (edits en editor pierdidos).** Solución: convención + docs. Si en 3 meses esto pasa más de una vez, considerar GitHub-protected `Code.gs` que solo CI puede tocar (técnica con git hooks).
