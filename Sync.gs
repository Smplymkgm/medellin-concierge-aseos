// ============================================================
// SINCRONIZAR AIRBNB (iCal → Sheets)  — trigger cada 6h
// ============================================================
// Cambios Fase 7 (robustez):
//  • LockService en sincronizarCalendarios y sincronizarHojaAseos
//  • Soft-cancel: reservas que desaparecen del iCal pero estaban Confirmada/
//    Pendiente quedan marcadas Cancelada (no se borran)
//  • Dedupe por (idProp, codigo) para evitar colisiones entre propiedades
//  • Batch writes en sincronizarHojaAseos (setValues único por sección)

function sincronizarCalendarios() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e) {
    Logger.log("sincronizarCalendarios: otro proceso en ejecucion, abortando");
    return;
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(CONFIG.hojaMaestra);
    if (!hoja) hoja = ss.insertSheet(CONFIG.hojaMaestra);

    var guardado    = leerDatosGuardados(hoja);
    var propiedades = getPropiedades();

    // Preservar filas manuales
    var manuales = [];
    if (hoja.getLastRow() > 1) {
      var filas = hoja.getRange(2,1,hoja.getLastRow()-1,13).getValues();
      for (var f of filas) {
        if (String(f[0]).startsWith("MANUAL-")) manuales.push([].concat(f));
      }
    }

    // OJO: NO limpiar aquí. Primero hacemos fetch y pasamos el circuit breaker;
    // solo entonces borramos y reescribimos. Si limpiáramos antes y Airbnb
    // fallara, el master quedaría vacío (se perderían asignaciones y datos).

    // Recolectar reservas activas del iCal. Dedup en DOS niveles para que el
    // master nunca muestre filas repetidas:
    //   • por código (HM…/UID son únicos globalmente en Airbnb), y
    //   • por estadía = propiedad + checkout (una sola limpieza por salida;
    //     cubre la misma estadía publicada por Airbnb y Booking a la vez).
    // FETCH PRIMERO, luego decidimos si limpiar o no. Esto evita que una
    // caída temporal de Airbnb borre el master sheet entero.
    var reservas = [];
    var vistosCod  = {};   // codigo -> true
    var vistosStay = {};   // (idProp|propiedad)+"|"+checkout -> true
    var propsConIcal = 0;
    var fetchesExitosos = 0;
    var propFetchOk = {};  // id de propiedad -> true si su iCal respondió (HTTP 200) este run

    // Antes: un UrlFetchApp.fetch() por propiedad, en secuencia (40
    // propiedades = 40 esperas de red una detrás de otra). A pocos cientos
    // de propiedades esto empieza a acercarse al límite de ejecución de
    // Apps Script (~6 min) y el sync deja de terminar. fetchAll() manda
    // todos los pedidos de una vez — Google los resuelve en paralelo del
    // lado de sus servidores — así que el tiempo total casi no crece aunque
    // el número de propiedades sí.
    var propsConUrls = propiedades.filter(function(p) { return p.icalUrl; });
    propsConIcal = propsConUrls.length;
    var reservasPorProp = obtenerReservasDeTodasLasPropiedades(propsConUrls);

    for (var p of propsConUrls) {
      var lista = reservasPorProp[p.id] || [];
      if (lista.fetchOk) propFetchOk[p.id] = true;
      if (lista.length > 0) fetchesExitosos++;
      for (var k = 0; k < lista.length; k++) {
        var r = lista[k];
        var kc = String(r.codigo || "");
        var ks = String(r.id || r.propiedad || "") + "|" + String(r.checkout || "");
        if (kc && vistosCod[kc]) continue;       // mismo código ya visto
        if (vistosStay[ks])      continue;       // misma estadía (propiedad+checkout) ya vista
        if (kc) vistosCod[kc] = true;
        vistosStay[ks] = true;
        reservas.push(r);
      }
    }
    reservas.sort(function(a,b){ return fechaADate(a.checkout) - fechaADate(b.checkout); });

    // CIRCUIT BREAKER: si esperábamos al menos N props con iCal y CERO
    // devolvieron datos, probablemente Airbnb está caído o cambió el
    // formato. Abortamos sin tocar el master para no perder reservas
    // confirmadas. La próxima sync (6h) reintenta.
    if (propsConIcal > 0 && fetchesExitosos === 0) {
      Logger.log("sincronizarCalendarios: " + propsConIcal + " iCals esperadas, 0 respondieron. Aborto para no perder datos.");
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Airbnb no respondió. Sync cancelada para proteger datos. Reintenta en 6h.",
        "Airbnb Sync", 8);
      return;
    }

    // Ya pasamos el circuit breaker (hay datos del feed) → ahora sí limpiamos
    // y reescribimos. 'guardado' y 'manuales' se leyeron ANTES de limpiar.
    limpiarDatos(hoja);
    configurarEncabezados(hoja);
    aplicarDropdowns(hoja);
    aplicarDropdownAseadorasEnTodosLosAseos();

    // Soft-cancel robusto: una reserva guardada que NO llegó en el iCal solo
    // se marca Cancelada si se cumplen las 3 condiciones. En cualquier otro
    // caso se PRESERVA tal cual (toda fila de 'guardado' que no esté en el feed
    // debe re-escribirse aquí, porque limpiarDatos ya vació la hoja).
    //   1) La propiedad SÍ respondió su iCal este run (si su feed falló, la
    //      ausencia no significa nada → no tocar).
    //   2) La reserva es a FUTURO. Airbnb solo exporta fechas futuras: una
    //      reserva cuyo checkout ya pasó se cae del feed sola (no es cancelación;
    //      la maneja autoCompletarAseosPasados).
    //   3) Lleva ≥2 syncs consecutivos ausente (debounce/gracia ~5h). Absorbe
    //      feeds parciales y retrasos de Airbnb (2–4h). El "ausente desde" se
    //      guarda en ScriptProperties, sin tocar el esquema de la hoja.
    var hoy0 = new Date(); hoy0.setHours(0,0,0,0);
    var ahoraMs   = Date.now();
    var GRACIA_MS = 5 * 60 * 60 * 1000;          // ~5h (< ciclo de 6h)
    var ausentes  = leerAusentesSoftCancel();    // { codigo: epochMs }
    var nuevosAusentes = {};

    var setIcal = {};
    for (var i = 0; i < reservas.length; i++) setIcal[reservas[i].codigo] = true;
    var cancelaciones = [];  // pendientes ausentes que PRESERVAMOS (no son cancelación aún)
    var removidas = 0;

    // Precio del catálogo por id de propiedad — fallback para filas
    // preservadas que ya perdieron su precio (bug histórico: preservar
    // escribía precio=0 y noches=0 fijos).
    var precioCatalogo = {};
    for (var pc = 0; pc < propiedades.length; pc++) {
      precioCatalogo[propiedades[pc].id] = Number(propiedades[pc].precioAseo) || 0;
    }

    function preservar(cod, est) {
      var g = guardado[cod];
      cancelaciones.push({
        codigo: cod, idProp: g.idProp || "", propiedad: g.propiedad || "",
        checkin: g.checkin || "", checkout: g.checkout || "",
        noches: g.noches || 0,
        estado: est,
        precio: g.precio || precioCatalogo[g.idProp] || 0,
        acceso: g.acceso || "", empleadaAuto: "",
      });
    }

    for (var cod in guardado) {
      if (setIcal[cod]) continue;                // presente en el feed → la re-escribe escribirReservas
      var est = guardado[cod].estado;

      // El master SOLO lleva pendientes. Finalizada (vive en "Todos los Aseos")
      // o Cancelada → se descarta del master (no se reescribe).
      if (est === "Finalizado" || est === "Cancelada") { removidas++; continue; }

      // Estados no-activos raros → descartar también (el master es solo pendientes).
      var estabaActiva = (est === "Confirmada" || est === "Pendiente" || est === "");
      if (!estabaActiva) { removidas++; continue; }

      // (1) ¿la propiedad respondió su feed? Si no, no sabemos nada → preservar.
      var idP = guardado[cod].idProp;
      var propRespondio = !idP || propFetchOk[idP];  // sin idProp (manual/legacy) → no tocar
      if (!propRespondio) { preservar(cod, est || "Confirmada"); continue; }

      // (2) ¿es a futuro? Si el checkout ya pasó, Airbnb la quita del feed sola.
      //     Eso NO significa que se canceló: el aseo pudo no haberse hecho. Lo
      //     PRESERVAMOS como pendiente (atrasado) hasta que se complete a mano.
      var coDate = fechaADate(guardado[cod].checkout);
      var esFutura = coDate && coDate >= hoy0;
      if (!esFutura) { preservar(cod, est || "Confirmada"); continue; }

      // (3) debounce: solo quitar si lleva ≥2 syncs ausente; si no, preservar.
      var desde = ausentes[cod];
      if (!desde) {                              // primera vez ausente → registrar y esperar
        nuevosAusentes[cod] = ahoraMs;
        preservar(cod, est || "Confirmada");
        continue;
      }
      if (ahoraMs - desde < GRACIA_MS) {         // aún en periodo de gracia → seguir esperando
        nuevosAusentes[cod] = desde;
        preservar(cod, est || "Confirmada");
        continue;
      }

      // Cumple las 3 → desaparición real. El master solo lleva pendientes, así
      // que la quitamos (no se reescribe) y sale del registro de ausentes.
      removidas++;
    }
    guardarAusentesSoftCancel(nuevosAusentes);

    escribirReservas(hoja, reservas, guardado, leerDesasignadosManual());

    // Escribir debajo las pendientes ausentes que PRESERVAMOS (glitch de feed o
    // dentro del periodo de gracia). Son pendientes vigentes, no cancelaciones.
    if (cancelaciones.length > 0) {
      var fiC = hoja.getLastRow() + 1;
      var filasC = cancelaciones.map(function(r) {
        var g = guardado[r.codigo] || {};
        return [r.codigo, r.idProp || "", r.propiedad || "", r.checkin, r.checkout, r.noches || 0,
                r.estado, g.empleada || "", r.precio || 0, g.notas || "", g.acceso || "",
                g.eventId || "", ""];
      });
      hoja.getRange(fiC, 1, filasC.length, 13).setValues(filasC);
      hoja.getRange(fiC, 4, filasC.length, 2).setNumberFormat("@");
      for (var c = 0; c < filasC.length; c++) {
        var estC = filasC[c][6];
        var bg = estC === "Finalizado" ? "#e8f5e9"
               : estC === "Cancelada"  ? "#fff3f3"
               : "#ffffff";  // preservada (feed no respondió): apariencia normal
        hoja.getRange(fiC + c, 1, 1, 13).setBackground(bg).setFontFamily("Arial").setFontSize(10);
      }
    }

    // Restaurar manuales al final
    if (manuales.length > 0) {
      var fi = hoja.getLastRow() + 1;
      hoja.getRange(fi, 1, manuales.length, 13).setValues(manuales);
      for (var i = 0; i < manuales.length; i++) {
        hoja.getRange(fi+i, 1, 1, 13).setBackground("#fff9e6").setFontFamily("Arial").setFontSize(10);
      }
    }

    sincronizarHojaAseos();

    SpreadsheetApp.getActiveSpreadsheet().toast(
      "✅ " + reservas.length + " reservas pendientes · " + removidas + " removidas (completadas/canceladas)",
      "Airbnb Sync", 5);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ------------------------------------------------------------
// Debounce del soft-cancel: registro de códigos ausentes del feed.
// Se guarda en ScriptProperties (no toca el esquema de la hoja). El mapa solo
// retiene los códigos que siguen pendientes de confirmar cancelación; en cada
// run se reescribe completo, así los que volvieron o ya se cancelaron salen.
// ------------------------------------------------------------
var SOFTCANCEL_PROP_KEY = "softcancel_ausentes";

function leerAusentesSoftCancel() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(SOFTCANCEL_PROP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function guardarAusentesSoftCancel(mapa) {
  try {
    PropertiesService.getScriptProperties()
      .setProperty(SOFTCANCEL_PROP_KEY, JSON.stringify(mapa || {}));
  } catch(e) {
    Logger.log("guardarAusentesSoftCancel: " + e.message);
  }
}

// ------------------------------------------------------------
// Desasignados a propósito: cuando el admin deja un aseo "sin asignar" desde
// asignarAseo, escribirReservas NO debe reponer la empleadaAuto de la
// propiedad en la próxima sync (antes lo hacía, por eso la desasignación
// "se revertía sola" al rato). Se guarda en ScriptProperties, igual que el
// soft-cancel, para no tocar el esquema de la hoja. handleAsignarAseo agrega
// el código aquí al vaciar la aseadora, y lo saca cuando se vuelve a asignar.
// ------------------------------------------------------------
var DESASIGNADOS_PROP_KEY = "desasignados_manual";

function leerDesasignadosManual() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(DESASIGNADOS_PROP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function marcarDesasignadoManual(codigo, desasignado) {
  try {
    var mapa = leerDesasignadosManual();
    if (desasignado) mapa[codigo] = true; else delete mapa[codigo];
    PropertiesService.getScriptProperties()
      .setProperty(DESASIGNADOS_PROP_KEY, JSON.stringify(mapa));
  } catch(e) {
    Logger.log("marcarDesasignadoManual: " + e.message);
  }
}

// ------------------------------------------------------------
// Recuperación one-shot: restaura a "Confirmada" toda reserva del master que
// esté "Cancelada" pero cuyo código SÍ aparece en los iCal actuales (= falso
// cancelado por el bug viejo). Las canceladas de verdad no están en el feed,
// así que se quedan como están. Correr desde el editor o el menú una vez.
// ------------------------------------------------------------
function recuperarCanceladosFalsos() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var master = ss.getSheetByName(CONFIG.hojaMaestra);
  if (!master || master.getLastRow() < 2) { ss.toast("Sin reservas", "Recuperar", 4); return; }

  // Códigos presentes en los iCal actuales.
  var enFeed = {};
  var props  = getPropiedades();
  for (var p of props) {
    if (!p.icalUrl) continue;
    var lista = obtenerReservasDeICal(p);
    for (var k = 0; k < lista.length; k++) enFeed[lista[k].codigo] = true;
  }

  var datos = master.getRange(2, 1, master.getLastRow()-1, 7).getValues();
  var ausentes = leerAusentesSoftCancel();
  var restauradas = 0;
  for (var i = 0; i < datos.length; i++) {
    var cod = String(datos[i][0]).trim();
    var est = String(datos[i][6]).trim();
    if (est !== "Cancelada") continue;
    if (!enFeed[cod]) continue;                 // no está en el feed → cancelación real, no tocar
    var fila = i + 2;
    master.getRange(fila, 7).setValue("Confirmada");
    master.getRange(fila, 1, 1, 13).setBackground(i % 2 === 0 ? "#f8f9fa" : "#ffffff");
    delete ausentes[cod];                        // limpiar del debounce
    restauradas++;
  }
  guardarAusentesSoftCancel(ausentes);
  ss.toast("✅ " + restauradas + " reservas restauradas a Confirmada", "Recuperar", 6);
  Logger.log("recuperarCanceladosFalsos: " + restauradas + " restauradas.");
}

// ============================================================
// iCAL — fetch + parse
// ============================================================

// Trae los iCal de MUCHAS propiedades a la vez con UrlFetchApp.fetchAll(),
// en vez de un fetch por propiedad en secuencia (ver obtenerReservasDeICal
// abajo, que sigue existiendo para el caso de una sola propiedad —
// recuperarCanceladosFalsos la usa así). Se manda en lotes de a 50 para no
// depender de que Apps Script soporte lotes arbitrariamente grandes, y para
// que una URL rota en un lote no arrastre a las demás.
// Devuelve { idProp: reservas[] }, con reservas.fetchOk = true si al menos
// un feed de esa propiedad respondió 200.
var ICAL_FETCHALL_LOTE = 50;

function obtenerReservasDeTodasLasPropiedades(propiedades) {
  var resultado = {};
  propiedades.forEach(function(p) {
    resultado[p.id] = [];
    resultado[p.id].fetchOk = false;
  });

  var pares = [];
  propiedades.forEach(function(p) {
    var urls = (p.icalUrls && p.icalUrls.length) ? p.icalUrls : (p.icalUrl ? [p.icalUrl] : []);
    urls.forEach(function(u) {
      var url = String(u || "").trim();
      if (url) pares.push({ prop: p, url: url });
    });
  });
  if (!pares.length) return resultado;

  var vistosPorProp = {};  // idProp -> {codigo:true}, dedup entre feeds de la misma propiedad

  for (var inicio = 0; inicio < pares.length; inicio += ICAL_FETCHALL_LOTE) {
    var lote = pares.slice(inicio, inicio + ICAL_FETCHALL_LOTE);
    var requests = lote.map(function(x) { return { url: x.url, muteHttpExceptions: true }; });
    var responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch(e) {
      // Un lote entero puede fallar por una URL mal formada — se loguea y se
      // sigue con el próximo lote en vez de perder todo el sync.
      Logger.log("obtenerReservasDeTodasLasPropiedades: lote falló (" + lote.length + " urls): " + e.message);
      continue;
    }

    for (var i = 0; i < lote.length; i++) {
      var prop = lote[i].prop;
      var url  = lote[i].url;
      var resp = responses[i];
      var arr  = resultado[prop.id];
      try {
        if (resp.getResponseCode() !== 200) {
          Logger.log("iCal " + prop.nombre + " HTTP " + resp.getResponseCode() + ": " + url);
          continue;
        }
        arr.fetchOk = true;
        var reservas = parsearICal(resp.getContentText(), prop);
        var vistos = vistosPorProp[prop.id] || (vistosPorProp[prop.id] = {});
        for (var k = 0; k < reservas.length; k++) {
          var cod = reservas[k].codigo;
          if (vistos[cod]) continue;  // mismo código en dos feeds de la misma propiedad
          vistos[cod] = true;
          arr.push(reservas[k]);
        }
      } catch(e) {
        Logger.log("Error procesando iCal " + prop.nombre + " (" + url + "): " + e.message);
      }
    }
  }

  return resultado;
}

function obtenerReservasDeICal(prop) {
  // Soporta múltiples iCal por propiedad (Airbnb + Booking + otros).
  var urls = (prop.icalUrls && prop.icalUrls.length) ? prop.icalUrls
           : (prop.icalUrl ? [prop.icalUrl] : []);
  var todas = [];
  var vistos = {};  // dedup por código entre feeds de la misma propiedad
  var algunFetchOk = false;  // ¿al menos un feed respondió HTTP 200?
  for (var u = 0; u < urls.length; u++) {
    var url = String(urls[u] || "").trim();
    if (!url) continue;
    try {
      var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) {
        Logger.log("iCal " + prop.nombre + " HTTP " + r.getResponseCode() + ": " + url);
        continue;
      }
      algunFetchOk = true;
      var reservas = parsearICal(r.getContentText(), prop);
      for (var k = 0; k < reservas.length; k++) {
        var cod = reservas[k].codigo;
        if (vistos[cod]) continue;  // mismo código en dos feeds → una sola vez
        vistos[cod] = true;
        todas.push(reservas[k]);
      }
    } catch(e) {
      Logger.log("Error iCal " + prop.nombre + " (" + url + "): " + e.message);
    }
  }
  todas.fetchOk = algunFetchOk;
  return todas;
}

function parsearICal(texto, prop) {
  var limpio  = texto.replace(/\r\n[ \t]/g, "");
  var eventos = limpio.split("BEGIN:VEVENT");
  var out = [];
  for (var i = 1; i < eventos.length; i++) {
    var ev  = eventos[i];
    var sum = extraer(ev, "SUMMARY") || "";
    if (sum.includes("Not available")) continue;
    var start = extraer(ev, "DTSTART");
    var end   = extraer(ev, "DTEND");
    if (!start || !end) continue;
    var startClean = start.replace(/[^0-9]/g,"").substring(0,8);
    var endClean   = end.replace(/[^0-9]/g,"").substring(0,8);
    if (startClean.length < 8 || endClean.length < 8) continue;
    var fi = new Date(
      parseInt(startClean.substring(0,4)),
      parseInt(startClean.substring(4,6))-1,
      parseInt(startClean.substring(6,8))
    );
    var fo = new Date(
      parseInt(endClean.substring(0,4)),
      parseInt(endClean.substring(4,6))-1,
      parseInt(endClean.substring(6,8))
    );
    if (isNaN(fi.getTime()) || isNaN(fo.getTime())) continue;
    if (fo <= fi) continue;
    // Ignorar eventos con STATUS:CANCELLED explícito en el iCal
    var icalStatus = extraer(ev, "STATUS") || "";
    if (icalStatus.toUpperCase() === "CANCELLED") continue;
    var desc = extraer(ev, "DESCRIPTION") || "";
    var hm   = desc.match(/reservations\/details\/(HM[A-Z0-9]+)/);
    var uid  = extraer(ev, "UID") || "";
    var cod  = hm ? hm[1] : uid.split("@")[0].substring(0, 20);
    out.push({
      codigo:       cod,
      id:           prop.id,
      propiedad:    prop.nombre,
      checkin:      formatearFecha(fi),
      checkout:     formatearFecha(fo),
      noches:       Math.round((fo - fi) / 86400000),
      estado:       "Confirmada",
      precio:       prop.precioAseo || 0,
      acceso:       prop.acceso || "",
      empleadaAuto: prop.empleadaAuto || "",
    });
  }
  return out;
}

function extraer(txt, campo) {
  var m = txt.match(new RegExp(campo + "[^:]*:([^\\n\\r]+)"));
  return m ? m[1].trim() : "";
}

// ============================================================
// HOJA MAESTRA — helpers
// ============================================================

function leerDatosGuardados(hoja) {
  var g = {};
  if (hoja.getLastRow() < 2) return g;
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var c = String(f[0]); if (!c) continue;
    g[c] = {
      idProp:    String(f[1] || ""),
      propiedad: String(f[2] || ""),
      empleada: String(f[7] || ""),
      estado:   String(f[6] || ""),
      noches:   Number(f[5]) || 0,
      precio:   Number(f[8]) || 0,
      notas:    String(f[9] || ""),
      acceso:   String(f[10] || ""),
      eventId:  String(f[11] || ""),
      checkin:  disp[i][0] || fechaToStr(f[3]),
      checkout: disp[i][1] || fechaToStr(f[4]),
    };
  }
  return g;
}

function configurarEncabezados(hoja) {
  var enc = ["Código Reserva","ID Propiedad","Propiedad","Check-in","Check-out","Noches",
             "Estado","Empleada Asignada","Precio Aseo","Notas","Acceso","Cal Event ID","Notas Admin"];
  hoja.getRange(1,1,1,enc.length).setValues([enc])
    .setBackground("#1a1a2e").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11).setFontFamily("Arial");
  [160,80,240,100,100,55,110,130,120,180,280,1,220].forEach(function(w,i){ hoja.setColumnWidth(i+1,w); });
  hoja.hideColumns(12);
  hoja.setFrozenRows(1);
}

function limpiarDatos(hoja) {
  // Un filtro o rango protegido hace que deleteRows lance error; si eso pasaba,
  // las filas viejas (duplicados, completados, cancelados) sobrevivían debajo
  // de los datos frescos. Por eso primero quitamos el filtro y luego limpiamos
  // con clearContent sobre TODO el rango bajo el encabezado, que nunca falla.
  try {
    var filtro = hoja.getFilter();
    if (filtro) filtro.remove();
  } catch(e) { Logger.log("limpiarDatos filtro: " + e.message); }

  var frozen = hoja.getFrozenRows() || 1;
  var first  = frozen + 1;

  // 1) Borrado por contenido (garantizado): limpia hasta la última fila REAL
  //    de la cuadrícula, no solo hasta getLastRow().
  try {
    var maxRows = hoja.getMaxRows();
    var maxCols = hoja.getMaxColumns();
    if (maxRows >= first) {
      hoja.getRange(first, 1, maxRows - frozen, maxCols).clearContent().clearFormat();
    }
  } catch(e) { Logger.log("limpiarDatos clear: " + e.message); }

  // 2) Además intentamos eliminar las filas sobrantes (deja la hoja compacta).
  try {
    var last = hoja.getLastRow();
    if (last >= first) hoja.deleteRows(first, last - frozen);
  } catch(e) { Logger.log("limpiarDatos delete: " + e.message); }
}

function escribirReservas(hoja, reservas, guardado, desasignados) {
  if (!reservas.length) return;
  desasignados = desasignados || {};
  var filas = reservas.map(function(r) {
    var g   = guardado[r.codigo] || {};
    var emp = g.empleada || "";
    if (!emp && r.empleadaAuto && !desasignados[r.codigo]) emp = r.empleadaAuto;
    var estado = g.estado === "Finalizado" ? "Finalizado" : (g.estado || r.estado);
    return [r.codigo, r.id, r.propiedad, r.checkin, r.checkout, r.noches,
            estado, emp, r.precio, g.notas||"", g.acceso||r.acceso||"",
            g.eventId||"", ""];
  });
  hoja.getRange(2, 1, filas.length, 13).setValues(filas);
  hoja.getRange(2, 4, filas.length, 2).setNumberFormat("@");
  for (var i = 0; i < filas.length; i++) {
    var bg = filas[i][6] === "Finalizado" ? "#e8f5e9" : i%2===0 ? "#f8f9fa" : "#ffffff";
    hoja.getRange(i+2, 1, 1, 13).setBackground(bg).setFontFamily("Arial").setFontSize(10);
  }
  hoja.getRange(2, 9, filas.length, 1).setNumberFormat("$#,##0");
}

// La lista de aseadoras del dropdown (columna H) se arma DINÁMICAMENTE desde
// la hoja Personal — antes estaba hardcodeada ("Ana","Fernanda","Claudia",
// "Admin"), así que cada aseadora nueva rompía asignarAseo con "violates the
// data validation rule" hasta que alguien tocara el código a mano. Con esto
// agregar una aseadora en Personal alcanza; el próximo sync (máx. 6h, o
// manual desde el menú) actualiza el dropdown solo.
function aplicarDropdowns(hoja) {
  hoja.getRange("H2:H2000").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(listaAseadorasValidas(), true)
      .setAllowInvalid(false).build()
  );
  hoja.getRange("G2:G2000").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["Confirmada","Cancelada","Pendiente","Finalizado"], true)
      .setAllowInvalid(false).build()
  );
}

function listaAseadorasValidas() {
  var nombres = getPersonal().map(function(p) { return p.nombre; }).filter(Boolean);
  // Nunca dejar la validación sin opciones (bloquearía TODA asignación) ni
  // perder "Admin" si por algún motivo no está activo en Personal.
  if (nombres.indexOf("Admin") === -1) nombres.push("Admin");
  if (!nombres.length) nombres = ["Admin"];
  return nombres;
}

// asignarAseo también puede escribir la aseadora en "Todos los Aseos"
// columna G (aseos ya iniciados/históricos) — esa columna tiene su PROPIA
// validación, independiente de la del master (columna H, arriba). Si no se
// refresca acá también, una aseadora nueva sigue rompiendo la asignación en
// cualquier aseo que ya tenga fila en esa hoja.
function aplicarDropdownAseadorasEnTodosLosAseos() {
  var hoja = getSS().getSheetByName(CONFIG.hojaAseos);
  if (!hoja) return;
  hoja.getRange(2, 7, Math.max(hoja.getMaxRows() - 1, 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(listaAseadorasValidas(), true)
      .setAllowInvalid(false).build()
  );
}

// ============================================================
// SINCRONIZAR HOJA ASEOS (desde master) — batch writes
// ============================================================

function sincronizarHojaAseos() {
  // Con el modelo de fuente dual, los PENDIENTES viven en "Todas las Reservas"
  // y la app los lee de ahí. "Todos los Aseos" es SOLO historial de
  // completados (creados al completar un aseo). Aquí solo limpiamos esa hoja:
  // conservamos las filas Completado y borramos el resto (pendientes viejos,
  // cancelados, vacíos).
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e) {
    Logger.log("sincronizarHojaAseos: otro proceso en ejecucion, abortando");
    return;
  }
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(CONFIG.hojaAseos);
    if (!hoja) {
      hoja = ss.insertSheet(CONFIG.hojaAseos);
      var enc = ["Código Reserva","ID Propiedad","Propiedad","Check-in","Check-out","Noches",
                 "Aseadora","Estado","Precio Aseo","Notas","Acceso","Cal Event ID","Completado"];
      hoja.getRange(1,1,1,enc.length).setValues([enc])
        .setBackground("#1a1a2e").setFontColor("#ffffff")
        .setFontWeight("bold").setFontSize(11).setFontFamily("Arial");
      hoja.setFrozenRows(1);
      hoja.hideColumns(12);
      return;
    }
    if (hoja.getLastRow() < 2) return;

    var rango = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
    var delRows = [];
    for (var i = 0; i < rango.length; i++) {
      var cod = String(rango[i][0]  || "").trim();
      var est = String(rango[i][7]  || "").trim();
      var marca = String(rango[i][11] || "").trim();           // col L (marca MANUAL)
      var fechaCompletado = String(rango[i][12] || "").trim();  // col M (Completado)
      // PROTECCIÓN DE PAGO: una fila con fecha de completado es un aseo hecho
      // = un pago que se debe → NUNCA se borra, aunque su Estado haya cambiado.
      if (fechaCompletado) continue;
      // Conservar completados y aseos manuales (MAN- o marca "MANUAL") aunque
      // estén pendientes.
      if (est === "Completado") continue;
      // "Iniciado" es progreso real de la aseadora (vive solo en esta hoja,
      // no en el master) → conservarlo o el sync borraría el estado.
      if (est === "Iniciado") continue;
      if (cod.indexOf("MAN") === 0) continue;
      if (marca === "MANUAL") continue;
      delRows.push(i + 2);
    }
    for (var d = delRows.length - 1; d >= 0; d--) hoja.deleteRow(delRows[d]);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ============================================================
// GOOGLE CALENDAR SYNC — trigger cada 2h
// ============================================================

function sincronizarGoogleCalendar() {
  // Corre cada 2h mientras sincronizarCalendarios corre cada 6h + diario —
  // sin lock, un cruce de horarios podía dejar esta función escribiendo
  // columna L (eventId) con índices de fila ya obsoletos si el otro sync
  // vaciaba/reescribía la hoja a mitad de este loop. Mismo lock que usa
  // sincronizarCalendarios para la misma hoja.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e) {
    Logger.log("sincronizarGoogleCalendar: otro proceso en ejecucion, abortando");
    return;
  }
  try {
    _sincronizarGoogleCalendarImpl();
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function _sincronizarGoogleCalendarImpl() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaMaestra);
  if (!hoja || hoja.getLastRow() < 2) return;

  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  var personal = getPersonal();
  var cal   = CalendarApp.getDefaultCalendar();
  var creados = 0, actualizados = 0;

  for (var i = 0; i < datos.length; i++) {
    var r       = datos[i];
    var fila    = i + 2;
    var codigo  = String(r[0]);
    var empNom  = String(r[7] || "");
    var estado  = String(r[6] || "");
    var eventId = String(r[11] || "");
    if (!codigo || !empNom) continue;

    if (estado === "Cancelada" || estado === "Finalizado") {
      if (eventId) {
        try { cal.getEventById(eventId).deleteEvent(); } catch(e) {}
        hoja.getRange(fila, 12).setValue("");
      }
      continue;
    }

    var emp = null;
    for (var j = 0; j < personal.length; j++) {
      if (personal[j].nombre === empNom) { emp = personal[j]; break; }
    }
    if (!emp || !emp.email) continue;

    var checkoutStr = disp[i][1] || fechaToStr(r[4]);
    var fecha = fechaADate(checkoutStr);
    if (!fecha) continue;

    var checkinStr = disp[i][0] || fechaToStr(r[3]);
    var inicio = new Date(fecha); inicio.setHours(11,0,0,0);
    var fin    = new Date(fecha); fin.setHours(15,0,0,0);
    var titulo = "🧹 Limpieza " + nombreDia(fecha) + " - " + r[2];
    var desc   = [
      "Codigo: " + codigo,
      "Check-in: " + checkinStr + "  →  Check-out: " + checkoutStr,
      "Noches: " + r[5],
      "Precio: $" + Number(r[8]).toLocaleString("es-CO"),
      r[9]  ? "Notas: " + r[9]   : "",
      r[10] ? "Acceso: " + r[10] : "",
    ].filter(Boolean).join("\n");

    if (eventId) {
      try {
        var ev = cal.getEventById(eventId);
        if (ev) {
          ev.setTitle(titulo); ev.setTime(inicio, fin); ev.setDescription(desc);
          var inv = ev.getGuestList().map(function(g){ return g.getEmail().toLowerCase(); });
          if (!inv.includes(emp.email.toLowerCase())) ev.addGuest(emp.email);
          actualizados++; continue;
        }
      } catch(e) {}
    }
    // Antes sin try/catch: una excepción acá (cuota, email inválido) abortaba
    // la función entera a mitad del loop, dejando el resto de filas sin
    // procesar en ese run. Ahora se loguea y sigue con la siguiente fila.
    try {
      var nEv = cal.createEvent(titulo, inicio, fin, {
        guests: emp.email, sendInvites: true, description: desc
      });
      hoja.getRange(fila, 12).setValue(nEv.getId());
      creados++;
    } catch(e) {
      Logger.log("sincronizarGoogleCalendar: error creando evento para " + codigo + ": " + e.message);
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "📅 " + creados + " creados, " + actualizados + " actualizados", "Google Calendar Sync", 5);
}
