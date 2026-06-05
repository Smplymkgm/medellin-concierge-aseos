# Security Review — Production Audit

Review focused en lo que un actor con acceso al GAS_URL (semi-secreto) puede hacer, y en cómo se protegen credenciales/sesión.

## Threat model

- **Atacante 1: descubre el GAS_URL** (semi-secreto, está en bundle JS público). Puede hacer POST anónimos.
- **Atacante 2: roba el localStorage de una aseadora**. Tiene sesión persistente con nombre + PIN.
- **Atacante 3: tiene acceso al repo en GitHub**. Puede ver código fuente, no secrets.
- **Atacante 4: hace ataque MITM sobre HTTPS** (descartable — TLS + HSTS + GitHub Pages).

## Authentication

| Aspecto | Estado |
|---|---|
| PIN 4 dígitos | ⚠ Baja entropía (10k combinaciones). Brute force protegido solo por latencia de Apps Script. **P2** |
| PIN en col C (texto plano) | ⚠ Quien tenga acceso al spreadsheet ve todos los PINs. Aceptable porque el spreadsheet es del owner. **P2** |
| Session token | Plain JSON en localStorage. Sin firma criptográfica. Quien lo robe puede impersonar. **P2** |
| Logout | Borra localStorage. ✅ |
| Re-auth on action | No hay. La sesión vive indefinidamente. **P3** |

## Authorization

Endpoint-by-endpoint review:

| Endpoint | Rol requerido | Validado server-side? | Impacto si abuse |
|---|---|---|---|
| `login` | ninguno | N/A | Brute-force PINs |
| `getPersonal` | ninguno | N/A | Leak de nombres y emails de aseadoras |
| `getDatos` | aseadora/admin | **❌ No valida quién pide** | Leak de TODOS los aseos a quien tenga URL |
| `completarAseo` | aseadora (la asignada) | ✅ Valida que `nombre` coincida con col 7 | OK |
| `asignarAseo` | admin | **❌ No valida** | Cualquiera puede reasignar |
| `moverAseo` | admin | **❌ No valida** | Cualquiera puede mover fechas |
| `agregarAseo` | admin | **❌ No valida** | Cualquiera puede crear aseos |
| `eliminarPropiedad` | admin | **❌ No valida** | Cualquiera puede archivar props |
| `actualizarPropiedad` | admin | **❌ No valida** | Cualquiera puede cambiar claves de acceso |
| `actualizarPersonal` | admin | **❌ No valida** | **Cualquiera puede cambiar PINs** |
| `agregarPropiedad` | admin | **❌ No valida** | Cualquiera crea propiedades fake |
| `getUploadUrl` / `registrarVideo` | aseadora | **❌ No valida** | Cualquiera puede subir a Drive |
| `runSelfTest` | ninguno | N/A — read-only | Bajo |

### Hallazgo P1 (mitigado pero no eliminado)

Todos los mutating endpoints son **ANYONE_ANONYMOUS**. Mitigación actual = el `GAS_URL` no es público. Mitigación real = agregar validación de rol/PIN al body de cada handler.

**Recomendación post-release**: agregar middleware `requireAdmin(body)` que verifique:
```js
var caller = personal.find(p => p.nombre === body.callerNombre);
if (!caller || caller.pin !== body.callerPin) return respond(false, null, "No autorizado");
if (requireAdmin && caller.nombre.toLowerCase() !== "admin") return respond(false, null, "Solo admin");
```

Y el frontend agrega `callerNombre`/`callerPin` a cada gasPost mutador. La sesión ya tiene ambos.

Estimado: 30 min de implementación + 1h de QA. **P1**. No bloquea release; recomendado en el próximo sprint.

## Information exposure

| Dato | Donde está | Riesgo |
|---|---|---|
| GAS_URL | bundle JS (público) | Aceptable. Solo es un endpoint, no un secret |
| Spreadsheet ID | Code.gs (gitignored sería ideal pero no esencial) | Bajo — sin acceso a Drive del owner es inútil |
| Tokens GitHub (gho_*) | `.claude/settings.local.json` local | **Local only, gitignored**. Rotar tras la sesión |
| HUBSPOT_API_KEY | `PropertiesService` (server-side) | ✅ Bien guardado |
| OAuth resumable Drive URL | corto-vivido, una sola vez | Bajo |
| Claves de propiedades (col D/H) | Spreadsheet | Quien tiene acceso al spreadsheet → tiene las claves |
| PINs de aseadoras | Spreadsheet col C | Idem |
| Emails de aseadoras y owner | Spreadsheet + getPersonal payload | Si GAS_URL leaks, emails leaks |

## Drive sharing

| Componente | Configuración | Riesgo |
|---|---|---|
| Folder raíz "Medellin Concierge - Videos Aseos" | anyone-with-link viewer | Aceptable: enlace solo accesible por quien tenga el spreadsheet |
| Subcarpetas por propiedad | herencia del padre | OK |
| Files | explícito anyone-with-link | OK |

Implicación: cualquiera con el link del video puede verlo sin login. Esto es **intencional** (Mike quiso esto). Si en el futuro Medcon trabaja con videos sensibles, cambiar a "specific people".

## XSS / CSRF / injection

| Vector | Estado |
|---|---|
| XSS via texto del spreadsheet | React escapa por default ✅ |
| `dangerouslySetInnerHTML` | No se usa ✅ |
| CSRF en doPost | No relevante: ANYONE_ANONYMOUS deliberado |
| SQL injection | N/A (no hay DB) |
| Formula injection en cells | `buildHyperlink` escapa `"` ✅ |
| Open redirect | No hay redirects controlados por user input ✅ |

## Recomendaciones priorizadas

1. **P1** Agregar `callerNombre`+`callerPin` validation a todos los mutating endpoints (ver arriba). 1-2h.
2. **P2** Hashear PINs en col C con bcrypt (requiere migración de datos). Out of scope.
3. **P2** Implementar TTL en localStorage session (e.g. 30 días).
4. **P3** Rotar token GitHub `gho_*` que quedó en `.claude/settings.local.json` local de Mike. Manual.
5. **P3** Renombrar `getDatos` para que solo devuelva los aseos del caller cuando sea aseadora (hoy admin y aseadora reciben distinto, pero la separación es por flag `rol` confiada del cliente).

## Sign-off security

**Estado: aceptable para release como app interna de Medcon** con las siguientes premisas:

- GAS_URL solo se comparte con el equipo
- Spreadsheet permanece privado del owner
- Aseadoras instalan en sus devices personales
- Si en el futuro Medcon expone esto como SaaS, el plan **R1** (proper auth middleware) es prerequisito.
