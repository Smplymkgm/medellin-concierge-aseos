# Bug Report — Production Audit

Bugs y comportamientos inesperados encontrados. Cada uno categorizado por severidad y estado.

## P0 — Críticos (bloquean prod)

Ninguno detectado al cierre de auditoría.

## P1 — Altos (impactan operación diaria)

### B-001 — Endpoints debug accesibles anónimamente (RESUELTO)

**Síntoma**: `POST /exec` con `action: "runResincronizarPrecios"` (u otros 9 run*/inspect*/debug) lo ejecuta sin auth.
**Impacto**: cualquiera con el GAS_URL podía modificar el spreadsheet o disparar operaciones costosas.
**Fix**: removidos 10 endpoints de `doPost`. Las funciones siguen accesibles vía menú del spreadsheet (requiere sesión del owner).
**Commit**: presente en este audit.

### B-002 — `aseoEnriched` no propagaba `accesoEstructurado` (RESUELTO)

**Síntoma**: editar clave de propiedad en admin guardaba bien en col H pero las aseadoras no veían el cambio.
**Fix**: commit `5f82843`.

### B-003 — `AgregarAseoSheet` crashea con props vacíos (RESUELTO)

**Síntoma**: ErrorBoundary "Cannot read properties of undefined (reading 'id')" después de login admin.
**Causa**: state init usaba `getProps()[0].id`; tras eliminar placeholders, `getProps()` arranca vacío.
**Fix**: commit `49deed8` — defensive defaults.

## P2 — Medios

### B-004 — `#0076` ID duplicado en Propiedades

**Síntoma**: 2 propiedades con mismo id `#0076` (confirmadas por Mike: dos listings Airbnb del mismo apto).
**Impacto**: `propById('#0076')` devuelve el primer match siempre. La segunda propiedad no es accesible vía lookup → si admin reasigna desde la card de la 2da, no encuentra precio/acceso correctamente.
**Mitigación recomendada**: renombrar el 2do a `#0076b` en col A. Backend ya soporta IDs no numéricos.
**Estado**: documentado, pendiente decisión.

### B-005 — `aplicarDropdowns` (Sync.gs) hardcoded a 4 aseadoras

**Síntoma**: si agregás una aseadora nueva en hoja Personal y luego corrés `sincronizarCalendarios`, la validación de col H sigue aceptando solo Ana/Fernanda/Claudia/Admin.
**Mitigación recomendada**: leer dinámicamente `getPersonal()` para construir la lista.
**Workaround**: editar col H ignorando la validación (Sheets permite).

### B-006 — Acceso estructurado vs texto libre divergen

**Síntoma**: editas col D manualmente en spreadsheet, pero col H sigue con la versión vieja parseada.
**Mitigación**: convención — solo edita desde la app, no toques cols D y H a mano.

### B-007 — Aseos con precio=0 contaban como 0 en payroll (RESUELTO PARCIAL)

**Síntoma**: Kardinal 604 marca "Sin cargo · paga propietario" en la card ✓, pero el total mensual de la aseadora suma 0 por esos aseos.
**Estado**: comportamiento correcto (la aseadora NO cobra esos aseos). Si en algún futuro Medcon decide pagar tarifa fija, basta poner el precio en col C.

### B-008 — Email notificación al asignar puede saltar silenciosamente

**Síntoma**: si la aseadora no tiene email en col D de Personal, `notificarAsignacionEmail` hace log y retorna sin error.
**Mitigación**: agregar emails en hoja Personal. Ya está documentado en HANDOFF.

### B-009 — Sync iCal pierde col K (acceso) si la reserva re-aparece

**Síntoma**: sincronizarCalendarios escribe `acceso = g.acceso || r.acceso` donde `g` es lo guardado. Si admin editó manualmente el acceso, se preserva. Si la reserva fue cancelada y vuelve, el acceso queda como el iCal lo manda.
**Bajo riesgo**: las reservas raramente se re-añaden tras cancelar.

### B-010 — Drive folder rename solo al próximo upload

**Síntoma**: si renombras una propiedad en admin, el folder de Drive sigue con el nombre viejo hasta que se suba un nuevo video.
**Workaround**: ya implementado (commit fbc8137) — al próximo upload se renombra.

## P3 — Bajos

### B-011 — `nights()` puede dar NaN

**Síntoma**: si por algún motivo el API devuelve checkin/checkout como strings no parseables.
**Mitigación**: el spreadsheet siempre escribe `dd/MM/yyyy` validado, así que en práctica no pasa.

### B-012 — MAN-NNNN con concurrencia

**Síntoma**: 2 admins agregan aseo manual al mismo tiempo → ambos podrían recibir `MAN-0042`.
**Mitigación**: bajísima concurrencia en práctica. Si pasa, manualmente renombrar.

### B-013 — autoCompletarAseosPasados marca sin form

**Comportamiento**: a las 10pm, aseos pasados sin completar pasan a "Completado" con timestamp "(auto)" — pero sin form.
**Estado**: intencional. Mike puede usar "Finalizar sin form" desde admin para hacerlo manualmente.

### B-014 — confirm() para archivar es nativo browser

**Mejora**: usar el componente Sheet de la app. Aceptable por baja frecuencia.

### B-015 — Drive sharing puede fallar para archivos individuales

**Síntoma**: `compartirAnyoneViewer(file)` try/catch silencioso. Si Drive rechaza por quota, el archivo queda sin compartir.
**Mitigación**: el folder padre sí queda compartido → la herencia cubre la mayoría de casos.

### B-016 — handleGetFormRespuestas con SHEET_ID hardcoded

**Síntoma**: si Mike borra el spreadsheet del Form, llamadas a `getFormRespuestas` retornan error. El frontend no lo usa, así que sin impacto.
**Recomendación**: considerar eliminar el handler si no se va a usar.

### B-017 — Trigger `notificarAdminAsignacionesPendientes` requiere admin con email

**Síntoma**: si no hay nadie con `nombre='Admin'` y email en Personal, el digest no se envía.
**Estado**: hay log "Sin email de Admin en hoja Personal — saltado". Documentado.

### B-018 — gh-pages branch acumula commits sin pruning

**Síntoma**: cada deploy crea un commit nuevo. La branch crece linealmente.
**Estado**: aceptable. Si en años llega a ser pesado, `git push --force-with-lease` con un commit nuevo desde main resolvería.

### B-019 — Cache buster manual antes del CI

**Síntoma**: si Mike pushea manualmente sin que corra deploy-pages.yml, queda con la versión vieja del cache buster.
**Estado**: en práctica todo va por CI.

### B-020 — Toast desaparece a los 2.2s

**Mejora**: mensajes de error podrían quedar más tiempo. Aceptable.

### B-021 — Drive upload progreso muestra 0% hasta `lengthComputable`

**Síntoma**: en algunos navegadores el evento no se dispara hasta cierto chunk; el usuario ve "subiendo 0%" por un momento.
**Estado**: cosmético.

## Failure modes

Escenarios de falla y respuesta del sistema:

| Falla | Comportamiento | OK? |
|---|---|---|
| Airbnb iCal URL devuelve 404 | `obtenerReservasDeICal` retorna []; el resto de propiedades siguen | ✅ |
| Google Calendar API rate limit | `try/catch` por evento; el resto continúa | ✅ |
| Sheets API quota exceeded | doPost retorna error a frontend; toast "Error: ..." | ✅ |
| 2 aseadoras completan al mismo tiempo | `LockService.waitLock(10s)` serializa | ✅ |
| 2 admin asignan al mismo aseo | `handleAsignarAseo` tiene LockService → último gana | ⚠ no error, segundo gana |
| Frontend pierde red | gasPost catch → toast "Error de conexión" | ✅ |
| Spreadsheet borrado por accidente | `getSS()` throws; doPost retorna error | ⚠ catastrófico pero detectable |
| Trigger duplicado | crearTriggersAutomaticos borra todos antes de crear | ✅ |
| Hoja Personal vacía | login retorna "Usuario no encontrado" | ✅ |
| Folder Drive borrado | `crearCarpetaPropiedad` crea uno nuevo, actualiza col G | ✅ |
| HUBSPOT_API_KEY no configurado | `notificarHubspot` log + return; no error | ✅ |
| `gasPost` con action desconocido | respond(false, "Accion desconocida: ...") | ✅ |
