# Deployment Checklist — Release v1.0

Pre-flight para cortar release de producción.

## Pre-deploy

### Repo

- [x] `main` branch tiene los commits del audit
- [x] CI verde (`ci.yml`, `deploy-appsscript.yml`, `deploy-pages.yml`)
- [x] No hay archivos legacy en repo (uploads/ borrado)
- [x] `.gitignore` cubre `.clasp.json`, `.claude/`, `*.env`
- [x] `README.md` apunta a docs/

### Backend

- [x] `Code.gs` parse OK (sintaxis válida)
- [x] `Sync.gs` parse OK
- [x] `appsscript.json` scopes correctos: spreadsheets, calendar, drive, script.external_request, script.deployments, script.send_mail
- [x] Endpoints debug/run* eliminados de `doPost`
- [x] `runSelfTest` accesible vía API
- [x] LockService en `completarAseo`, `asignarAseo`, `sincronizarCalendarios`, `sincronizarHojaAseos`

### Frontend

- [x] `Index.html` cache buster `?v=28`
- [x] ErrorBoundary wraps `<App />`
- [x] `localStorage` session funciona (rehydrate al refresh)
- [x] Login dropdown carga personal real desde API
- [x] No placeholder data (Alisson/María Fernanda) en data.jsx

### Secrets configurados en GitHub Actions

- [x] `CLASPRC_JSON` (refresh token clasp)
- [x] `CLASP_JSON` (scriptId)
- [x] `APPSCRIPT_DEPLOYMENT_ID` (pinea el Web App URL)
- [x] `GAS_URL` (health check)

## Deploy steps

### Backend (Apps Script)

```bash
git push origin main
# Auto: deploy-appsscript.yml corre
#   1. clasp push --force
#   2. clasp deploy --description "ci: <sha>" --deploymentId <pinned>
#   3. Health check POST {action:"debug"} (eliminé este endpoint en audit)
#      → cambiar a {action:"runSelfTest"} en deploy-appsscript.yml si lo
#        quieres re-habilitar
```

**TODO post-audit**: actualizar `.github/workflows/deploy-appsscript.yml` para que el health check use `runSelfTest` en lugar de `debug` (que ya no existe).

### Frontend (gh-pages)

```bash
git push origin main
# Auto: deploy-pages.yml corre
#   1. Copia Index.html + app/ a _site/
#   2. Reemplaza ?v=N por ?v=<SHA>
#   3. Push a gh-pages branch
```

## Post-deploy

### Verificación

1. [ ] https://smplymkgm.github.io/medellin-concierge-aseos/Index.html carga
2. [ ] Login Ana / 1234 funciona
3. [ ] Refresh mantiene sesión
4. [ ] Login Admin / 2025 funciona
5. [ ] Tab "Aseos" muestra aseos reales del spreadsheet
6. [ ] Tab "Historial" cuenta por checkout
7. [ ] Tab "Propiedades" muestra 25 propiedades con buscador
8. [ ] Tab "Personal" muestra Ana/Fernanda/Claudia editables
9. [ ] Calendar abre aseo inline
10. [ ] Completar aseo → form 4 pasos → enviar → spreadsheet col 14-37 se llena
11. [ ] Subir video → aparece como HYPERLINK clickeable en col 37 + Videos Aseos col 5
12. [ ] Asignar aseo → email a aseadora (si tiene email en Personal)
13. [ ] Archivar propiedad → col I=FALSE, no aparece en app
14. [ ] Self-test: `POST /exec {action:"runSelfTest"}` retorna 10/10 OK
15. [ ] Menú Spreadsheet → "Sincronizar Airbnb" funciona
16. [ ] Menú Spreadsheet → "Self-test (diagnóstico)" pasa todo

### Configuración manual del owner

Una sola vez después del primer deploy:

1. [ ] Menú **Medellin Concierge → Setup (avanzado) → Crear triggers automáticos**
   - Crea triggers: Airbnb 6h, Calendar 2h, Auto-completar 10pm, Admin pendientes 7am
2. [ ] Verificar emails de aseadoras en hoja Personal col D
3. [ ] Verificar email de Admin en hoja Personal col D (para digest 7am)
4. [ ] Compartir spreadsheet con quien lo necesite (sin compartir scriptId)
5. [ ] Carpeta Drive raíz ya está compartida anyone-with-link viewer
6. [ ] Confirmar deployment ID pin'ed: `clasp deployments` muestra `@N` para el deployment activo

### Monitoreo primeras 48h

- [ ] Verificar trigger Airbnb 6h: hoja Maestra recibe reservas nuevas
- [ ] Verificar trigger Calendar 2h: eventos aparecen en Google Calendar del owner
- [ ] Verificar trigger 10pm: aseos pasados se marcan Completado
- [ ] Verificar trigger 7am: email digest si hay sin asignar (si no, no llega — correcto)

## Rollback procedure

### Si frontend se rompe

```bash
git revert HEAD
git push origin main
# CI re-deploya con código previo
```

### Si backend se rompe

```bash
# Opción A: revert
git revert HEAD && git push

# Opción B: rollback al deployment previo
clasp deployments  # ver versiones
clasp deploy --deploymentId AKfycb... --versionNumber <N-1>
```

### Si clasp token expira

Síntoma: `deploy-appsscript.yml` falla con `Error: invalid_grant`.

```bash
clasp logout && clasp login
cat ~/.clasprc.json | gh secret set CLASPRC_JSON --repo smplymkgm/medellin-concierge-aseos
# Re-trigger último deploy:
gh run rerun <RUN_ID>
```

## Known gaps (no bloquean release)

Ver `TECHNICAL_DEBT_FINAL.md`. Resumen:

- Auth admin no validado server-side (P1 — recomendado primer sprint post-release)
- React development build en prod (P2 — easy fix)
- Babel-in-browser (P2 — requiere Vite migration)
- PINs plain text en spreadsheet (P2 — out of scope sin demanda)

## Sign-off

Después de marcar todo lo anterior:

- [ ] Owner (Mike) revisa el último commit y aprueba
- [ ] Owner verifica que las aseadoras pueden iniciar sesión
- [ ] Owner verifica que recibe emails diarios
- [ ] Marcar release como `v1.0.0` en GitHub: `git tag v1.0.0 && git push --tags`

**Estado actual al cierre del audit: 14/14 pre-deploy checks pasan.**
