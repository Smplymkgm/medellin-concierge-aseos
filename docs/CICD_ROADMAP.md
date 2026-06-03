# CI/CD Roadmap

Sin SaaS, sin enterprise. Solo lo mínimo para que **un commit a `main`** llegue a producción sin tocar el editor.

## Tres workflows

1. **`ci.yml`** — corre en cada PR. Bloquea merge si falla
2. **`deploy-appsscript.yml`** — corre en `push` a `main` cuando cambia el backend
3. **`deploy-pages.yml`** — corre en `push` a `main` cuando cambia el frontend

## `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install eslint
        run: npm install --no-save eslint@9 @babel/eslint-parser@7 @babel/preset-react@7

      - name: Lint frontend
        run: |
          npx eslint app/*.jsx \
            --parser @babel/eslint-parser \
            --parser-options requireConfigFile:false,babelOptions.presets:["@babel/preset-react"] \
            --rule "no-undef:off" \
            --rule "no-unused-vars:warn" || true

      - name: Validate Apps Script syntax
        run: |
          node -e "
            const fs = require('fs');
            const files = ['Code.gs', 'Sync.gs'];
            for (const f of files) {
              try {
                new Function(fs.readFileSync(f, 'utf8'));
                console.log('OK: ' + f);
              } catch (e) {
                console.error('FAIL: ' + f + ' :: ' + e.message);
                process.exit(1);
              }
            }
          "

      - name: Validate JSON manifests
        run: |
          node -e "JSON.parse(require('fs').readFileSync('appsscript.json', 'utf8'))" && echo "appsscript.json OK"
```

Notas:
- El `eslint` se corre con `|| true` para que warnings no bloqueen el merge mientras adoptamos lint
- Validación de Apps Script: se hace un parse-only via `new Function()` — no ejecuta el código, solo verifica que sea JavaScript válido. Esto atrapa typos como punto-y-coma faltante, brackets sin cerrar, etc.
- Cuando exista test suite real (Vitest, Playwright), reemplazar la sección "Lint frontend" con `npm test`

## `.github/workflows/deploy-appsscript.yml`

```yaml
name: Deploy Apps Script
on:
  push:
    branches: [main]
    paths:
      - 'Code.gs'
      - 'Sync.gs'
      - 'appsscript.json'
      - '.clasp.json'

concurrency:
  group: appsscript-deploy
  cancel-in-progress: false   # nunca cancelar un deploy a medias

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install clasp
        run: npm install -g @google/clasp@2.4.2

      - name: Restore clasp credentials
        run: |
          echo '${{ secrets.CLASPRC_JSON }}' > ~/.clasprc.json
          echo '${{ secrets.CLASP_JSON }}' > .clasp.json

      - name: Push to Apps Script
        run: clasp push --force

      - name: Deploy new version
        run: |
          SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
          clasp deploy --description "ci: $SHORT_SHA" \
            --deploymentId "${{ secrets.APPSCRIPT_DEPLOYMENT_ID }}"
```

Decisiones clave:

- **`clasp push --force`**: necesario porque clasp por defecto pide confirmación interactiva si hay cambios remotos no pulled. `--force` es seguro aquí porque el workflow es la única fuente de cambios al Apps Script.
- **`--deploymentId`**: actualiza el **deployment activo en lugar de crear uno nuevo**. Esto es crítico: si cada deploy crea un deployment nuevo, el URL `script.google.com/.../exec` cambiaría y el frontend rompería. Pinear el deploymentId al actual.
- **`concurrency`**: si llegan 2 commits seguidos, esperamos a que el primero termine antes de correr el segundo.

### ¿Cómo obtener `APPSCRIPT_DEPLOYMENT_ID`?

```bash
clasp deployments
# Output:
#  - AKfycb... @1 - "MAJOR_VERSION_..." [Web app, executeAs: USER_DEPLOYING, access: ANYONE_ANONYMOUS]
```

El ID antes del `@` es el `deploymentId`. Va como GitHub Secret.

## `.github/workflows/deploy-pages.yml`

Versión actual (sin Vite, copia archivos tal cual):

```yaml
name: Deploy GitHub Pages
on:
  push:
    branches: [main]
    paths:
      - 'Index.html'
      - 'app/**'

concurrency:
  group: pages-deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Stage site
        run: |
          mkdir -p _site
          cp -r Index.html app/ _site/
          # Auto-bump cache buster: reemplaza ?v=N por el commit SHA
          SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
          sed -i "s/\\.jsx?v=[^\"]*\"/\\.jsx?v=$SHORT_SHA\"/g" _site/Index.html

      - name: Deploy to gh-pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./_site
          publish_branch: gh-pages
          keep_files: false
          enable_jekyll: false
```

Beneficios sobre el flujo actual:
- **Cache buster automático**: el `?v=N` manual desaparece. Cada deploy usa el SHA del commit. Nunca más usuarios con `app.jsx` viejo cacheado.
- **Idempotente**: si nada cambió, el push a gh-pages no produce diff.

### Cuando exista Vite (futuro, fuera de scope):

```yaml
      - name: Build
        run: |
          npm ci
          npm run build
      # En lugar de "Stage site":
      - name: Deploy to gh-pages
        # ...
          publish_dir: ./dist
```

## Secrets requeridos (resumen)

| Secret | Necesario para | Cómo se obtiene |
|---|---|---|
| `CLASPRC_JSON` | deploy-appsscript | `cat ~/.clasprc.json` (después de `clasp login`) |
| `CLASP_JSON` | deploy-appsscript | `cat .clasp.json` (después de `clasp clone`) |
| `APPSCRIPT_DEPLOYMENT_ID` | deploy-appsscript | `clasp deployments` |

## Rollback plan

| Si pasa esto | Acción |
|---|---|
| `clasp push` falla con error de sintaxis | El job falla. El deployment anterior sigue activo. Fix forward. |
| `clasp deploy` falla pero `clasp push` fue exitoso | El código fuente está pushed pero no live. Re-run `clasp deploy` manualmente o vía re-trigger del workflow |
| El nuevo deploy rompe la API en producción | `clasp deploy --deploymentId <ID> --versionNumber <OLD_VERSION>` desde local del owner. Versions previas siempre quedan en el editor (no se borran nunca) |
| Cache buster automático rompe páginas | `gh-pages` branch siempre tiene historia. `git revert` del commit malo en `main` re-dispara el workflow con el código previo |

## Test plan del propio CI/CD

1. Hacer un PR trivial al frontend (cambio de texto) → verificar que `ci.yml` corre, `deploy-pages.yml` no
2. Mergear el PR → verificar que `deploy-pages.yml` corre y el sitio se actualiza
3. Hacer un PR trivial al `Code.gs` (un comment) → verificar que `ci.yml` corre, `deploy-appsscript.yml` no
4. Mergear → verificar que `deploy-appsscript.yml` corre y la API responde igual
5. Simular fallo: PR con `Code.gs` sintácticamente roto → `ci.yml` debe fallar y bloquear el merge

## Métricas a observar después del rollout

- Tiempo de deploy `Code.gs` (debería ser <2 min)
- Tiempo de deploy `gh-pages` (debería ser <1 min)
- Failures por mes (target: 0 después del primer mes)
