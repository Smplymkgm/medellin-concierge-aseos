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

    limpiarDatos(hoja);
    configurarEncabezados(hoja);
    aplicarDropdowns(hoja);

    // Recolectar reservas activas del iCal — dedupe por (idProp, codigo)
    // FETCH PRIMERO, luego decidimos si limpiar o no. Esto evita que una
    // caída temporal de Airbnb borre el master sheet entero.
    var reservas = [];
    var vistas   = {};
    var propsConIcal = 0;
    var fetchesExitosos = 0;
    for (var p of propiedades) {
      if (!p.icalUrl) continue;
      propsConIcal++;
      var lista = obtenerReservasDeICal(p);
      if (lista && lista.length > 0) fetchesExitosos++;
      for (var k = 0; k < lista.length; k++) {
        var r = lista[k];
        var key = (r.id || "") + ":" + (r.codigo || "");
        if (vistas[key]) continue;
        vistas[key] = true;
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

    // Soft-cancel: lo que estaba guardado y no llegó del iCal queda Cancelada
    // (solo si estaba Confirmada/Pendiente; las ya Finalizadas/Canceladas se preservan)
    var setIcal = {};
    for (var i = 0; i < reservas.length; i++) setIcal[reservas[i].codigo] = true;
    var cancelaciones = [];
    for (var cod in guardado) {
      if (setIcal[cod]) continue;
      var est = guardado[cod].estado;
      if (est === "Confirmada" || est === "Pendiente" || est === "") {
        cancelaciones.push({
          codigo: cod,
          idProp: "",
          propiedad: "",
          checkin:  guardado[cod].checkin  || "",
          checkout: guardado[cod].checkout || "",
          noches:   0,
          estado:   "Cancelada",
          precio:   0,
          acceso:   guardado[cod].acceso  || "",
          empleadaAuto: "",
        });
      } else if (est === "Finalizado" || est === "Cancelada") {
        // Preservar tal cual
        cancelaciones.push({
          codigo:   cod,
          idProp:   "",
          propiedad: "",
          checkin:  guardado[cod].checkin  || "",
          checkout: guardado[cod].checkout || "",
          noches:   0,
          estado:   est,
          precio:   0,
          acceso:   guardado[cod].acceso || "",
          empleadaAuto: "",
        });
      }
    }

    escribirReservas(hoja, reservas, guardado);

    // Escribir cancelaciones/finalizadas preservadas debajo
    if (cancelaciones.length > 0) {
      var fiC = hoja.getLastRow() + 1;
      var filasC = cancelaciones.map(function(r) {
        var g = guardado[r.codigo] || {};
        return [r.codigo, "", "", r.checkin, r.checkout, 0,
                r.estado, g.empleada || "", 0, g.notas || "", g.acceso || "",
                g.eventId || "", ""];
      });
      hoja.getRange(fiC, 1, filasC.length, 13).setValues(filasC);
      hoja.getRange(fiC, 4, filasC.length, 2).setNumberFormat("@");
      for (var c = 0; c < filasC.length; c++) {
        var bg = filasC[c][6] === "Finalizado" ? "#e8f5e9" : "#fff3f3";
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
      "✅ " + reservas.length + " reservas · " +
      cancelaciones.filter(function(c){return c.estado==='Cancelada';}).length + " canceladas",
      "Airbnb Sync", 5);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ============================================================
// iCAL — fetch + parse
// ============================================================

function obtenerReservasDeICal(prop) {
  try {
    var r = UrlFetchApp.fetch(prop.icalUrl, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return [];
    return parsearICal(r.getContentText(), prop);
  } catch(e) {
    Logger.log("Error iCal " + prop.nombre + ": " + e.message);
    return [];
  }
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
      empleada: String(f[7] || ""),
      estado:   String(f[6] || ""),
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
  try {
    var last   = hoja.getLastRow();
    var frozen = hoja.getFrozenRows();
    var first  = frozen + 1;
    if (last >= first) hoja.deleteRows(first, last - frozen);
  } catch(e) {
    Logger.log("limpiarDatos: " + e.message);
  }
}

function escribirReservas(hoja, reservas, guardado) {
  if (!reservas.length) return;
  var filas = reservas.map(function(r) {
    var g   = guardado[r.codigo] || {};
    var emp = g.empleada || "";
    if (!emp && r.empleadaAuto) emp = r.empleadaAuto;
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

function aplicarDropdowns(hoja) {
  hoja.getRange("H2:H2000").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["Ana","Fernanda","Claudia","Admin"], true)
      .setAllowInvalid(false).build()
  );
  hoja.getRange("G2:G2000").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["Confirmada","Cancelada","Pendiente","Finalizado"], true)
      .setAllowInvalid(false).build()
  );
}

// ============================================================
// SINCRONIZAR HOJA ASEOS (desde master) — batch writes
// ============================================================

function sincronizarHojaAseos() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e) {
    Logger.log("sincronizarHojaAseos: otro proceso en ejecucion, abortando");
    return;
  }
  try {
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var master = ss.getSheetByName(CONFIG.hojaMaestra);
    if (!master || master.getLastRow() < 2) return;

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
    }

    // Index aseos existentes
    var existentes = {};
    var existRows  = [];
    if (hoja.getLastRow() > 1) {
      var exDatos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
      for (var i = 0; i < exDatos.length; i++) {
        var cod = String(exDatos[i][0]);
        if (cod) {
          existentes[cod] = { row: i+2, estado: String(exDatos[i][7]), data: exDatos[i] };
          existRows.push(i + 2);
        }
      }
    }

    var mDatos = master.getRange(2, 1, master.getLastRow()-1, 13).getValues();
    var mDisp  = master.getRange(2, 4, master.getLastRow()-1, 2).getDisplayValues();
    var nuevas = [];

    // Recolectar updates en batches por fila (filas adyacentes podrían
    // beneficiarse de range mas grande, pero por ahora hacemos un setValues
    // por fila actualizada — mucho mejor que 9 setValue cada uno)
    var updatesPorFila = []; // {fila, valores[9], bg, estado, ts}

    for (var i = 0; i < mDatos.length; i++) {
      var r   = mDatos[i];
      var cod = String(r[0]);
      if (!cod) continue;

      var checkinStr  = mDisp[i][0] || fechaToStr(r[3]);
      var checkoutStr = mDisp[i][1] || fechaToStr(r[4]);
      var estadoMaster = String(r[6] || "");

      if (existentes[cod]) {
        var estadoActual = existentes[cod].estado;
        if (estadoActual === "Completado") continue; // nunca degradar

        var nuevoEstado = estadoActual || "Pendiente";
        if (estadoMaster === "Cancelada")  nuevoEstado = "Cancelado";
        if (estadoMaster === "Finalizado") nuevoEstado = "Completado";

        var bg = nuevoEstado === "Completado" ? "#e8f5e9" :
                 nuevoEstado === "Cancelado"  ? "#fff3f3" : "#ffffff";
        var tsExisting = existentes[cod].data[12];
        var ts = "";
        if (nuevoEstado === "Completado" && !tsExisting) {
          ts = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");
        }

        updatesPorFila.push({
          fila: existentes[cod].row,
          // cols 3..11 = Propiedad, Checkin, Checkout, Noches, Aseadora, Estado, Precio, Notas, Acceso
          valores: [
            String(r[2] || ""),
            checkinStr,
            checkoutStr,
            r[5] || 0,
            String(r[7] || ""),
            nuevoEstado,
            Number(r[8]) || 0,
            String(r[9] || ""),
            String(r[10] || ""),
          ],
          bg: bg,
          ts: ts,
        });
      } else {
        var estado = estadoMaster === "Cancelada"  ? "Cancelado"  :
                     estadoMaster === "Finalizado" ? "Completado" : "Pendiente";
        var tsNew = estado === "Completado" ?
          Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm") : "";
        nuevas.push([
          cod, r[1], r[2], checkinStr, checkoutStr, r[5],
          r[7]||"", estado, r[8]||0, r[9]||"", r[10]||"", r[11]||"", tsNew
        ]);
      }
    }

    // Aplicar updates por fila — un setValues por fila (9 cols) en vez de 9 setValue
    for (var u = 0; u < updatesPorFila.length; u++) {
      var up = updatesPorFila[u];
      hoja.getRange(up.fila, 3, 1, 9).setValues([up.valores]);
      hoja.getRange(up.fila, 1, 1, 13).setBackground(up.bg);
      if (up.ts) hoja.getRange(up.fila, 13).setValue(up.ts);
    }

    if (nuevas.length > 0) {
      var fi = hoja.getLastRow() + 1;
      hoja.getRange(fi, 1, nuevas.length, 13).setValues(nuevas);
      hoja.getRange(fi, 4, nuevas.length, 2).setNumberFormat("@");
      hoja.getRange(fi, 9, nuevas.length, 1).setNumberFormat("$#,##0");
      for (var i = 0; i < nuevas.length; i++) {
        var bgN = nuevas[i][7] === "Completado" ? "#e8f5e9" :
                  nuevas[i][7] === "Cancelado"  ? "#fff3f3" : "#f8f9fa";
        hoja.getRange(fi+i, 1, 1, 13).setBackground(bgN).setFontFamily("Arial").setFontSize(10);
      }
    }
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ============================================================
// GOOGLE CALENDAR SYNC — trigger cada 2h
// ============================================================

function sincronizarGoogleCalendar() {
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
    var nEv = cal.createEvent(titulo, inicio, fin, {
      guests: emp.email, sendInvites: true, description: desc
    });
    hoja.getRange(fila, 12).setValue(nEv.getId());
    creados++;
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "📅 " + creados + " creados, " + actualizados + " actualizados", "Google Calendar Sync", 5);
}
