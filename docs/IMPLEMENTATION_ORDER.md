# Implementation Order

Orden recomendado. Cada paso es independiente — si después de uno hay un blocker, podemos pausar sin dejar el sistema peor que estaba.

## Reglas

1. **Cero cambios de lógica.** Si un paso requiere tocar la lógica de negocio, lo separamos en otro PR.
2. **Cada paso debe ser revertible** con `git revert`.
3. **Production-first.** Si un paso introduce riesgo de regresión, agregamos verificación manual antes del siguiente paso.
4. **No empezar paso N+1 hasta que paso N esté en `main` y verificado en producción.**

## Pasos

### Paso 1 — Branch protection + CODEOWNERS (15 min)

**Quien:** Mike, desde GitHub Settings.

- Settings → Branches → Add rule para `main`:
  - Require pull request before merging
  - Require status checks (los agregamos en Paso 3)
  - Allow administrators to bypass (para hotfix)
- Crear `.github/CODEOWNERS` con `* @smplymkgm`

**Verificación**: hacer un PR trivial; verificar que el merge requiere PR (no se permite push directo).

**Riesgo**: ninguno. Es solo configuración.

---

### Paso 2 — Configurar clasp localmente + GitHub Secrets (30 min)

**Quien:** Mike, desde su Mac.

```bash
npm install -g @google/clasp@2.4.2
clasp login    # OAuth flow en browser
cd "/Users/mike/Downloads/Medcon Cleanings"
# Identificar Script ID del proyecto:
#   editor Apps Script → ⚙️ Settings → Script ID
clasp clone <SCRIPT_ID> --rootDir .
clasp pull     # sincroniza con lo que esté en el editor
# Verifica que .clasp.json se creó y que Code.gs / Sync.gs / appsscript.json no tienen diff inesperado
git diff Code.gs Sync.gs appsscript.json
```

Si hay diff:
- Si el editor tiene cambios que el repo no: hacer commit de esos cambios.
- Si el repo tiene cambios que el editor no: `clasp push` para subirlos (sincroniza).

Una vez sincronizado:
```bash
git add .clasp.json .claspignore
```

`.claspignore`:
```
**/**
!appsscript.json
!Code.gs
!Sync.gs
```

Commit y push.

**GitHub Secrets** (Settings → Secrets and variables → Actions):

```bash
# CLASPRC_JSON:
cat ~/.clasprc.json | pbcopy  # → pegar en secret CLASPRC_JSON

# CLASP_JSON:
cat .clasp.json | pbcopy      # → pegar en secret CLASP_JSON

# APPSCRIPT_DEPLOYMENT_ID:
clasp deployments
# Output incluye una línea como:
#   - AKfycb...deploymentId @1 - "Description" [Web app, ...]
# Copiar el deploymentId (antes del "@") y pegarlo en secret APPSCRIPT_DEPLOYMENT_ID
```

**Verificación**: `clasp push --force` desde local funciona y al refrescar el editor se ve el mismo contenido.

**Riesgo**: R1, R4. Mitigación: ya documentada en `RISK_ANALYSIS.md`.

---

### Paso 3 — Workflow `ci.yml` (20 min)

Crear `.github/workflows/ci.yml` con el contenido de `CICD_ROADMAP.md`.

**Verificación**: hacer un PR con un typo en `Code.gs` (`var x = ;`) → `ci.yml` debe fallar y bloquear merge. Cerrar PR sin mergear.

**Riesgo**: ninguno (no toca production).

**Una vez verificado**: configurar el job `validate` como required check en branch protection (Settings → Branches → main → Require status checks → seleccionar `validate`).

---

### Paso 4 — Workflow `deploy-appsscript.yml` (30 min)

Crear `.github/workflows/deploy-appsscript.yml` con el contenido de `CICD_ROADMAP.md`.

**Verificación**:
1. Hacer un PR con un cambio trivial a `Code.gs` (agregar un comentario)
2. Merge a `main`
3. Verificar que `deploy-appsscript.yml` corre y termina exitoso
4. Verificar en el editor de Apps Script que aparece la nueva versión con descripción `ci: <SHA>`
5. Verificar que el deploymentId del Web App **NO** cambió (URL sigue siendo el mismo)
6. Hacer POST de prueba a `${GAS_URL}` con `action: 'debug'` y verificar respuesta `{ok:true,...}`

**Riesgo**: R1 (URL cambia). Mitigación activa: `--deploymentId` flag.

---

### Paso 5 — Workflow `deploy-pages.yml` con auto cache-bust (20 min)

Crear `.github/workflows/deploy-pages.yml` con el contenido de `CICD_ROADMAP.md`.

**Verificación**:
1. PR trivial a `app/app.jsx` (cambio cosmético, por ejemplo un comentario)
2. Merge a `main`
3. Verificar que `deploy-pages.yml` corre y la branch `gh-pages` recibe el commit
4. Verificar en https://smplymkgm.github.io/medellin-concierge-aseos/ que el `?v=N` en el HTML ahora dice `?v=<SHA del commit>` (mirar source con DevTools)

**Riesgo**: R6 (downtime). Mitigación: `keep_files: false` produce replace atómico.

---

### Paso 6 — Documentación operativa en HANDOFF.md (15 min)

Actualizar `docs/HANDOFF.md`:

- Sección "Cómo deployar cambios" → reemplazar instrucciones manuales por: "Hacer PR a `main` y mergear. CI hace el resto."
- Agregar "Si necesitas hotfix de emergencia": (Mike puede bypass branch protection).
- Documentar el proceso de regenerar `CLASPRC_JSON` si caduca.

**Riesgo**: ninguno (solo docs).

---

### Paso 7 — Partir `Code.gs` por dominio (1-2 h, OPCIONAL)

Ver `GITHUB_FIRST_ROADMAP.md` Paso 7. Hacer el split en archivos `00-config.gs`, `01-router.gs`, `10-auth.gs`, etc.

**Cero cambios de lógica.** Solo `git mv` lógico (cortar/pegar entre archivos).

**Verificación**:
1. Push a una branch
2. `clasp push --force` desde local debe subir todos los archivos
3. En el editor verificar que aparecen como pestañas separadas
4. POST a `${GAS_URL}` con `action: 'debug'` debe seguir funcionando
5. Si todo bien, merge a `main`

**Riesgo**: R3 (si alguien tiene edits sin guardar en el editor, se pierden). Mitigación: `clasp pull` inmediatamente antes.

---

### Paso 8 — Mover `apps-script/` (1 h, OPCIONAL)

Si Paso 7 se hizo, también podemos mover los archivos a `apps-script/` para separar visualmente. Cambios:

- `git mv *.gs apps-script/`
- `git mv appsscript.json apps-script/`
- Actualizar `.clasp.json`: `"rootDir": "apps-script/"`
- Actualizar `.claspignore` y workflows.

**Riesgo**: R4. Verificación cuidadosa antes del primer `clasp push --force`.

---

### Paso 9 — Quitar `GAS_URL` hardcoded del frontend (30 min)

Mover `GAS_URL` a un `<meta name="gas-url" content="...">` en `Index.html`, inyectado por el workflow `deploy-pages.yml` (usando un secret o variable). `app.jsx` lee `document.querySelector('meta[name=gas-url]').content`.

Beneficio: si el deployment URL cambia (paso forzado de R1 sin mitigar), se actualiza el meta sin tocar JS.

**Riesgo**: bajo. Si el meta no existe (durante migración), fallback al hardcoded.

---

### Paso 10 — Sub-deudas técnicas de bajo esfuerzo (a discreción)

De `TECHNICAL_DEBT.md`, los items **S** (esfuerzo bajo) y bloqueantes del objetivo:

- B4: codigo MAN- con UUID en vez de lastRow
- B9: agregar LockService al resto de mutaciones
- F2: ya resuelto con paso 5
- F6: agregar error boundary global
- F7: disable de botones durante in-flight
- I10: `.github/dependabot.yml`

Cada uno es un PR pequeño.

---

## Fuera de scope de esta sesión

- Mover lógica de Apps Script a un backend Node/Workers (Sprint 4+ del `MIGRATION_ROADMAP.md`).
- Adoptar Vite/build pipeline (Sprint 1 del MIGRATION_ROADMAP).
- Multi-tenant, SaaS, billing.
- Migrar a Postgres.

Esos quedan para fases posteriores. La sesión actual se enfoca en **deploy automatizado** y **GitHub como source of truth**.

---

## Checkpoint de éxito

Después de Paso 6, el éxito se mide así:

- [x] Mike hace `git push` a `main` y el frontend aparece desplegado en <2 min sin tocar `gh-pages` branch manualmente
- [x] Mike hace `git push` a `main` con cambio a `Code.gs` y la API se actualiza en <2 min sin tocar el editor
- [x] El URL de la API (`${GAS_URL}`) no cambia entre deploys
- [x] Un PR con código roto bloquea el merge
- [x] El editor Apps Script ya no es donde se hacen cambios

Si los 5 checks pasan, el objetivo primario está cumplido. Pasos 7-10 son refinamiento.
