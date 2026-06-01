// ============================================================
// CONFIGURACIÓN
// ============================================================

var CONFIG = {
  hojaMaestra:     "📋 Todas las Reservas",
  hojaAseos:       "🧹 Todos los Aseos",
  hojaPropiedades: "⚙️ Propiedades",
  hojaPersonal:    "👩 Personal",
  hojaVideos:      "📹 Videos Aseos",
  carpetaRaiz:     "Medellin Concierge - Videos Aseos",
  meses: ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
          "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
};

// ============================================================
// UTILIDADES DE FECHA
// ============================================================

function fechaToStr(val) {
  if (!val) return "";
  if (Object.prototype.toString.call(val) === "[object Date]") {
    var d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return String(d.getDate()).padStart(2,"0") + "/" +
           String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
  }
  var s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return s;
}

function fechaADate(val) {
  if (!val) return null;
  if (Object.prototype.toString.call(val) === "[object Date]") {
    var d = new Date(val); d.setHours(0,0,0,0); return d;
  }
  var s = String(val).trim();
  var p = s.split("/");
  if (p.length !== 3) return null;
  var d = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
  d.setHours(0,0,0,0); return d;
}

function formatearFecha(fecha) {
  return Utilities.formatDate(fecha, "America/Bogota", "dd/MM/yyyy");
}

function getMesAnio(fechaStr) {
  var p = String(fechaStr).split("/");
  if (p.length !== 3) return "Sin fecha";
  var mesIdx = parseInt(p[1]) - 1;
  if (mesIdx < 0 || mesIdx > 11) return "Sin fecha";
  return CONFIG.meses[mesIdx] + " " + p[2];
}

function nombreDia(fecha) {
  return ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"][fecha.getDay()];
}

function hoyStr() {
  return formatearFecha(new Date());
}

// ============================================================
// RESPONSE HELPER
// ============================================================

function respond(ok, data, error) {
  var payload = { ok: ok };
  if (data !== null && data !== undefined) payload.data = data;
  if (error) payload.error = String(error);
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ROUTER — doPost
// ============================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === "login")               return handleLogin(body);
    if (action === "getAseos")            return handleGetAseos(body);
    if (action === "completarAseo")       return handleCompletarAseo(body);
    if (action === "getAllAseos")          return handleGetAllAseos(body);
    if (action === "asignarAseo")         return handleAsignarAseo(body);
    if (action === "moverAseo")           return handleMoverAseo(body);
    if (action === "getPropiedades")      return handleGetPropiedades(body);
    if (action === "agregarPropiedad")    return handleAgregarPropiedad(body);
    if (action === "actualizarPropiedad") return handleActualizarPropiedad(body);
    if (action === "getPersonal")         return handleGetPersonal(body);
    if (action === "actualizarPersonal")  return handleActualizarPersonal(body);
    if (action === "getUploadUrl")        return handleGetUploadUrl(body);
    if (action === "registrarVideo")      return handleRegistrarVideo(body);

    return respond(false, null, "Accion desconocida: " + action);
  } catch(err) {
    Logger.log("doPost error: " + err.message + "\n" + err.stack);
    return respond(false, null, err.message);
  }
}

// doGet kept for health-check
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, version: "2.0", fecha: hoyStr() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// AUTH
// ============================================================

function handleLogin(body) {
  var nombre = String(body.nombre || "").trim();
  var pin    = String(body.pin    || "").trim();
  if (!nombre || !pin) return respond(false, null, "Nombre y PIN requeridos");

  var personal = getPersonal();
  var usuario  = null;
  for (var i = 0; i < personal.length; i++) {
    if (personal[i].nombre.toLowerCase() === nombre.toLowerCase()) {
      usuario = personal[i]; break;
    }
  }
  if (!usuario) return respond(false, null, "Usuario no encontrado");
  if (usuario.pin !== pin) return respond(false, null, "PIN incorrecto");

  var rol = nombre.toLowerCase() === "admin" ? "admin" : "aseadora";
  return respond(true, { rol: rol, nombre: usuario.nombre });
}

// ============================================================
// LEER PERSONAL
// ============================================================

function getPersonal() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaPersonal);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 7).getValues();
  var result = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var activa = r[0] === true || r[0] === "TRUE" || r[0] === "true";
    var nombre = String(r[1] || "").trim();
    if (!activa || !nombre) continue;
    result.push({
      nombre:     nombre,
      pin:        String(r[2] || "").trim(),
      email:      String(r[3] || "").trim(),
      formulario: String(r[4] || "").trim(),
      carpeta:    String(r[5] || "").trim(),
      telefono:   String(r[6] || "").trim(),
    });
  }
  return result;
}

// ============================================================
// ASEADORA — getAseos
// ============================================================

function handleGetAseos(body) {
  var nombre = String(body.nombre || "").trim();
  if (!nombre) return respond(false, null, "Nombre requerido");

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  var proximos  = [];
  var historial = [];

  if (hoja && hoja.getLastRow() >= 2) {
    var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
    var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
    var hoy   = new Date(); hoy.setHours(0,0,0,0);

    for (var i = 0; i < datos.length; i++) {
      var r = datos[i];
      if (String(r[6]).trim() !== nombre) continue;

      var checkinStr  = disp[i][0] || fechaToStr(r[3]);
      var checkoutStr = disp[i][1] || fechaToStr(r[4]);
      var estado      = String(r[7] || "");
      var precio      = Number(r[8]) || 0;
      var accesoRaw   = String(r[10] || "");
      var checkout    = fechaADate(checkoutStr);

      if (!checkout) continue;

      var aseo = {
        codigo:    String(r[0]),
        idProp:    String(r[1]).trim(),
        propiedad: String(r[2]).trim(),
        checkin:   checkinStr,
        checkout:  checkoutStr,
        noches:    Number(r[5]) || 0,
        estado:    estado,
        precio:    precio,
        notas:     String(r[9]  || ""),
        accesos:   accesoRaw ? accesoRaw.split("|").map(function(a){return a.trim();}).filter(Boolean) : [],
      };

      if (estado === "Completado") {
        // Completado siempre va al historial, sin importar la fecha
        aseo.fechaCompletado = String(r[12] || "");
        historial.push(aseo);
      } else if (checkout >= hoy) {
        if (estado !== "Cancelado") proximos.push(aseo);
      } else {
        aseo.fechaCompletado = String(r[12] || "");
        historial.push(aseo);
      }
    }
  }

  proximos.sort(function(a,b){
    var da = fechaADate(a.checkout), db = fechaADate(b.checkout);
    return da && db ? da - db : 0;
  });
  historial.sort(function(a,b){
    var da = fechaADate(a.checkout), db = fechaADate(b.checkout);
    return da && db ? db - da : 0;
  });

  // Calcular ganancias totales
  var totalGanado = 0;
  for (var j = 0; j < historial.length; j++) {
    if (historial[j].estado === "Completado") totalGanado += historial[j].precio;
  }

  return respond(true, { proximos: proximos, historial: historial, totalGanado: totalGanado });
}

// ============================================================
// ASEADORA — completarAseo
// ============================================================

function handleCompletarAseo(body) {
  var codigo    = String(body.codigo    || "").trim();
  var nombre    = String(body.nombre    || "").trim();
  var notas     = String(body.notas     || "").trim();
  var videoLink = String(body.videoLink || "").trim();

  if (!codigo || !nombre) return respond(false, null, "Codigo y nombre requeridos");

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  var hoy   = new Date(); hoy.setHours(0,0,0,0);
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();

  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]) !== codigo) continue;
    if (String(datos[i][6]).trim() !== nombre) return respond(false, null, "No autorizado");

    var checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
    var checkout    = fechaADate(checkoutStr);
    if (!checkout)      return respond(false, null, "Fecha invalida");
    if (checkout > hoy) return respond(false, null, "No puedes completar aseos futuros");

    var fila  = i + 2;
    var ahora = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");
    hoja.getRange(fila, 8).setValue("Completado");
    hoja.getRange(fila, 13).setValue(ahora);
    if (notas) hoja.getRange(fila, 10).setValue(notas);
    hoja.getRange(fila, 1, 1, 13).setBackground("#e8f5e9").setFontFamily("Arial").setFontSize(10);

    // Sync al master
    var master = ss.getSheetByName(CONFIG.hojaMaestra);
    if (master && master.getLastRow() >= 2) {
      var mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
      for (var j = 0; j < mc.length; j++) {
        if (String(mc[j][0]) === codigo) {
          master.getRange(j+2, 7).setValue("Finalizado");
          master.getRange(j+2, 1, 1, 13).setBackground("#e8f5e9");
          break;
        }
      }
    }

    // Registrar video si se proporcionó
    if (videoLink) {
      registrarVideoEnHoja({
        codigo:    codigo,
        propiedad: String(datos[i][2]),
        aseadora:  nombre,
        checkout:  checkoutStr,
        videoLink: videoLink,
        notas:     notas,
      });
    }

    return respond(true, null);
  }
  return respond(false, null, "Aseo no encontrado");
}

// ============================================================
// ADMIN — getAllAseos
// ============================================================

function handleGetAllAseos(body) {
  var filtroAseadora = String(body.filtroAseadora || "").trim().toLowerCase();
  var fechaInicio    = String(body.fechaInicio    || "").trim();
  var fechaFin       = String(body.fechaFin       || "").trim();

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return respond(true, []);

  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  var dInicio = fechaInicio ? fechaADate(fechaInicio) : null;
  var dFin    = fechaFin    ? fechaADate(fechaFin)    : null;

  var result = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    if (!String(r[0])) continue;

    var aseadora    = String(r[6] || "").trim();
    var checkinStr  = disp[i][0] || fechaToStr(r[3]);
    var checkoutStr = disp[i][1] || fechaToStr(r[4]);
    var checkout    = fechaADate(checkoutStr);

    // Filtro aseadora
    if (filtroAseadora && aseadora.toLowerCase() !== filtroAseadora) continue;
    // Filtro fechas
    if (dInicio && checkout && checkout < dInicio) continue;
    if (dFin    && checkout && checkout > dFin)    continue;

    result.push({
      codigo:          String(r[0]),
      idProp:          String(r[1]).trim(),
      propiedad:       String(r[2]).trim(),
      checkin:         checkinStr,
      checkout:        checkoutStr,
      noches:          Number(r[5]) || 0,
      aseadora:        aseadora,
      estado:          String(r[7] || ""),
      precio:          Number(r[8]) || 0,
      notas:           String(r[9]  || ""),
      acceso:          String(r[10] || ""),
      fechaCompletado: String(r[12] || ""),
    });
  }

  result.sort(function(a,b){
    var da = fechaADate(a.checkout), db = fechaADate(b.checkout);
    return da && db ? da - db : 0;
  });

  return respond(true, result);
}

// ============================================================
// ADMIN — asignarAseo
// ============================================================

function handleAsignarAseo(body) {
  var codigo   = String(body.codigo   || "").trim();
  var aseadora = String(body.aseadora || "").trim();
  if (!codigo) return respond(false, null, "Codigo requerido");

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  var aseoInfo = null;

  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]) !== codigo) continue;
    var fila = i + 2;
    hoja.getRange(fila, 7).setValue(aseadora);

    var checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
    aseoInfo = {
      codigo:    codigo,
      propiedad: String(datos[i][2]),
      checkout:  checkoutStr,
    };
    break;
  }

  if (!aseoInfo) return respond(false, null, "Aseo no encontrado");

  // Sync al master
  var master = ss.getSheetByName(CONFIG.hojaMaestra);
  if (master && master.getLastRow() >= 2) {
    var mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
    for (var j = 0; j < mc.length; j++) {
      if (String(mc[j][0]) === codigo) {
        master.getRange(j+2, 8).setValue(aseadora);
        break;
      }
    }
  }

  // Notificar HubSpot
  if (aseadora) notificarHubspot(aseoInfo, aseadora);

  return respond(true, null);
}

// ============================================================
// ADMIN — moverAseo
// ============================================================

function handleMoverAseo(body) {
  var codigo     = String(body.codigo     || "").trim();
  var nuevaFecha = String(body.nuevaFecha || "").trim(); // dd/MM/yyyy

  if (!codigo || !nuevaFecha) return respond(false, null, "Codigo y nuevaFecha requeridos");
  if (!fechaADate(nuevaFecha)) return respond(false, null, "Fecha invalida (usar dd/MM/yyyy)");

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var encontrado = false;

  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]) !== codigo) continue;
    var fila = i + 2;
    hoja.getRange(fila, 5).setValue(nuevaFecha).setNumberFormat("@");
    encontrado = true;
    break;
  }

  if (!encontrado) return respond(false, null, "Aseo no encontrado");

  // Sync al master
  var master = ss.getSheetByName(CONFIG.hojaMaestra);
  if (master && master.getLastRow() >= 2) {
    var mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
    for (var j = 0; j < mc.length; j++) {
      if (String(mc[j][0]) === codigo) {
        master.getRange(j+2, 5).setValue(nuevaFecha).setNumberFormat("@");
        break;
      }
    }
  }

  return respond(true, null);
}

// ============================================================
// PROPIEDADES
// ============================================================

function getPropiedades() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var lastCol = Math.max(hoja.getLastColumn(), 7);
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, lastCol).getValues();
  var props = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var id  = String(r[0]).trim();
    var nom = String(r[1]).trim();
    var url = String(r[4]).trim();
    if (!id || !nom || !url) continue;
    props.push({
      id:            id,
      nombre:        nom,
      precioAseo:    Number(r[2]) || 0,
      acceso:        String(r[3] || "").trim(),
      icalUrl:       url,
      empleadaAuto:  String(r[5] || "").trim(),
      folderId:      String(r[6] || "").trim(),
    });
  }
  return props;
}

function handleGetPropiedades(body) {
  return respond(true, getPropiedades());
}

function handleAgregarPropiedad(body) {
  var datos = body.datos || {};
  var nombre    = String(datos.nombre    || "").trim();
  var acceso    = String(datos.acceso    || "").trim();
  var icalUrl   = String(datos.icalUrl   || "").trim();
  var precioAseo = Number(datos.precioAseo) || 0;
  var empleadaAuto = String(datos.empleadaAuto || "").trim();

  if (!nombre || !icalUrl) return respond(false, null, "Nombre e iCal URL requeridos");

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja) return respond(false, null, "Hoja Propiedades no encontrada");

  // Generar ID
  var existentes = [];
  if (hoja.getLastRow() > 1) {
    existentes = hoja.getRange(2, 1, hoja.getLastRow()-1, 1).getValues().flat().map(String);
  }
  var nums = existentes.map(function(id){ return parseInt(id.replace("#","")) || 0; });
  var maxNum = nums.length ? Math.max.apply(null, nums) : 0;
  var nuevoId = "#" + String(maxNum + 1).padStart(4, "0");

  // Crear carpeta Drive
  var folderId = "";
  try { folderId = crearCarpetaPropiedad(nombre); } catch(e) { Logger.log("Drive: " + e.message); }

  var nuevaFila = [nuevoId, nombre, precioAseo, acceso, icalUrl, empleadaAuto, folderId];
  var fi = hoja.getLastRow() + 1;
  hoja.getRange(fi, 1, 1, 7).setValues([nuevaFila]);
  hoja.getRange(fi, 3, 1, 1).setNumberFormat("$#,##0");
  hoja.getRange(fi, 1, 1, 7)
    .setBackground(fi % 2 === 0 ? "#f8f9fa" : "#ffffff")
    .setFontFamily("Arial").setFontSize(10);

  return respond(true, { id: nuevoId });
}

function handleActualizarPropiedad(body) {
  var id    = String(body.id || "").trim();
  var datos = body.datos || {};
  if (!id) return respond(false, null, "ID requerido");

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  var existentes = hoja.getRange(2, 1, hoja.getLastRow()-1, 7).getValues();
  for (var i = 0; i < existentes.length; i++) {
    if (String(existentes[i][0]).trim() !== id) continue;
    var fila = i + 2;
    if (datos.nombre      !== undefined) hoja.getRange(fila, 2).setValue(datos.nombre);
    if (datos.precioAseo  !== undefined) hoja.getRange(fila, 3).setValue(Number(datos.precioAseo));
    if (datos.acceso      !== undefined) hoja.getRange(fila, 4).setValue(datos.acceso);
    if (datos.icalUrl     !== undefined) hoja.getRange(fila, 5).setValue(datos.icalUrl);
    if (datos.empleadaAuto !== undefined) hoja.getRange(fila, 6).setValue(datos.empleadaAuto);
    return respond(true, null);
  }
  return respond(false, null, "Propiedad no encontrada: " + id);
}

// ============================================================
// PERSONAL
// ============================================================

function handleGetPersonal(body) {
  var personal = getPersonal();
  // También calcular ganancias de cada aseadora
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  var ganancias = {};

  if (hoja && hoja.getLastRow() >= 2) {
    var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 9).getValues();
    for (var i = 0; i < datos.length; i++) {
      var nombre = String(datos[i][6] || "").trim();
      var estado = String(datos[i][7] || "");
      var precio = Number(datos[i][8]) || 0;
      if (!nombre) continue;
      if (!ganancias[nombre]) ganancias[nombre] = 0;
      if (estado === "Completado") ganancias[nombre] += precio;
    }
  }

  var result = personal.map(function(p) {
    return {
      nombre:     p.nombre,
      email:      p.email,
      formulario: p.formulario,
      carpeta:    p.carpeta,
      telefono:   p.telefono,
      gananciaTotal: ganancias[p.nombre] || 0,
    };
  });
  return respond(true, result);
}

function handleActualizarPersonal(body) {
  var nombre = String(body.nombre || "").trim();
  var datos  = body.datos || {};
  if (!nombre) return respond(false, null, "Nombre requerido");

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaPersonal);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  var existentes = hoja.getRange(2, 1, hoja.getLastRow()-1, 7).getValues();
  for (var i = 0; i < existentes.length; i++) {
    if (String(existentes[i][1]).trim().toLowerCase() !== nombre.toLowerCase()) continue;
    var fila = i + 2;
    if (datos.pin       !== undefined) hoja.getRange(fila, 3).setValue(String(datos.pin)).setNumberFormat("@");
    if (datos.email     !== undefined) hoja.getRange(fila, 4).setValue(datos.email);
    if (datos.carpeta   !== undefined) hoja.getRange(fila, 6).setValue(datos.carpeta);
    if (datos.telefono  !== undefined) hoja.getRange(fila, 7).setValue(datos.telefono);
    if (datos.formulario !== undefined) hoja.getRange(fila, 5).setValue(datos.formulario);
    return respond(true, null);
  }
  return respond(false, null, "Empleada no encontrada: " + nombre);
}

// ============================================================
// VIDEOS — getUploadUrl
// ============================================================

function handleGetUploadUrl(body) {
  var codigo    = String(body.codigo    || "").trim();
  var propiedad = String(body.propiedad || "").trim();
  var filename  = String(body.filename  || "video.mp4").trim();

  // Buscar folder ID de la propiedad
  var props    = getPropiedades();
  var folderId = "";
  for (var i = 0; i < props.length; i++) {
    if (props[i].nombre === propiedad || props[i].id === propiedad) {
      folderId = props[i].folderId; break;
    }
  }

  // Si no hay folder, crear uno
  if (!folderId) {
    try {
      folderId = crearCarpetaPropiedad(propiedad);
      // Guardar el folderId en la hoja
      actualizarFolderIdPropiedad(propiedad, folderId);
    } catch(e) {
      return respond(false, null, "No se pudo crear carpeta Drive: " + e.message);
    }
  }

  // Crear resumable upload URL via Drive API
  try {
    var token = ScriptApp.getOAuthToken();
    var fecha = hoyStr().replace(/\//g, "-");
    var nombreArchivo = fecha + "_" + codigo + "_" + filename;
    var metadata = { name: nombreArchivo, parents: [folderId] };

    var response = UrlFetchApp.fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "post",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true,
      }
    );

    var uploadUrl = response.getHeaders()["Location"] || response.getHeaders()["location"];
    if (!uploadUrl) {
      return respond(false, null, "No se obtuvo URL de upload (respuesta: " + response.getContentText() + ")");
    }

    return respond(true, { uploadUrl: uploadUrl, folderId: folderId, filename: nombreArchivo });
  } catch(e) {
    return respond(false, null, e.message);
  }
}

// ============================================================
// VIDEOS — registrarVideo (después del upload)
// ============================================================

function handleRegistrarVideo(body) {
  var codigo    = String(body.codigo    || "").trim();
  var propiedad = String(body.propiedad || "").trim();
  var aseadora  = String(body.aseadora  || "").trim();
  var checkout  = String(body.checkout  || "").trim();
  var fileId    = String(body.fileId    || "").trim();
  var notas     = String(body.notas     || "").trim();

  var videoLink = fileId
    ? "https://drive.google.com/file/d/" + fileId + "/view"
    : String(body.videoLink || "").trim();

  registrarVideoEnHoja({ codigo, propiedad, aseadora, checkout, videoLink, notas });
  return respond(true, null);
}

function registrarVideoEnHoja(data) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaVideos);
  if (!hoja) {
    hoja = ss.insertSheet(CONFIG.hojaVideos);
    var enc = ["Código Aseo","Propiedad","Aseadora","Checkout","Link Video","Notas","Registrado"];
    hoja.getRange(1,1,1,enc.length).setValues([enc])
      .setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold").setFontFamily("Arial");
    hoja.setFrozenRows(1);
  }
  var ahora = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");
  hoja.appendRow([data.codigo, data.propiedad, data.aseadora, data.checkout, data.videoLink, data.notas, ahora]);
}

// ============================================================
// HUBSPOT
// ============================================================

function notificarHubspot(aseo, aseadora) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("HUBSPOT_API_KEY");
  if (!apiKey) return;
  var payload = {
    properties: {
      subject: "Aseo asignado: " + aseo.propiedad,
      hs_note_body: "Aseadora: " + aseadora + " | Checkout: " + aseo.checkout + " | Codigo: " + aseo.codigo,
    }
  };
  try {
    UrlFetchApp.fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "post",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch(e) {
    Logger.log("HubSpot error: " + e.message);
  }
}

// ============================================================
// DRIVE — helpers
// ============================================================

function getCarpetaRaiz() {
  var folders = DriveApp.getFoldersByName(CONFIG.carpetaRaiz);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(CONFIG.carpetaRaiz);
}

function crearCarpetaPropiedad(nombrePropiedad) {
  var raiz = getCarpetaRaiz();
  var existing = raiz.getFoldersByName(nombrePropiedad);
  if (existing.hasNext()) return existing.next().getId();
  return raiz.createFolder(nombrePropiedad).getId();
}

function actualizarFolderIdPropiedad(nombrePropiedad, folderId) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) return;
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 2).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][1]).trim() === nombrePropiedad) {
      hoja.getRange(i+2, 7).setValue(folderId);
      return;
    }
  }
}

// ============================================================
// AUTO-COMPLETAR ASEOS PASADOS (trigger 10PM)
// ============================================================

function autoCompletarAseosPasados() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return;

  var hoy   = new Date(); hoy.setHours(0,0,0,0);
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  var ahora = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");

  var count = 0;
  for (var i = 0; i < datos.length; i++) {
    var estado = String(datos[i][7]);
    if (estado === "Completado" || estado === "Cancelado") continue;
    if (!String(datos[i][6])) continue;

    var checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
    var checkout    = fechaADate(checkoutStr);
    if (!checkout || checkout >= hoy) continue;

    var fila   = i + 2;
    var codigo = String(datos[i][0]);
    hoja.getRange(fila, 8).setValue("Completado");
    hoja.getRange(fila, 13).setValue(ahora + " (auto)");
    hoja.getRange(fila, 1, 1, 13).setBackground("#e8f5e9");

    var master = ss.getSheetByName(CONFIG.hojaMaestra);
    if (master && master.getLastRow() >= 2) {
      var mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
      for (var j = 0; j < mc.length; j++) {
        if (String(mc[j][0]) === codigo) {
          master.getRange(j+2, 7).setValue("Finalizado");
          master.getRange(j+2, 1, 1, 13).setBackground("#e8f5e9");
          break;
        }
      }
    }
    count++;
  }
  Logger.log("autoCompletarAseosPasados: " + count + " aseos marcados.");
}

// ============================================================
// MENÚ
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🏠 Medellin Concierge")
    .addItem("🔄 Sincronizar Airbnb",           "sincronizarCalendarios")
    .addItem("📅 Sincronizar Google Calendar",   "sincronizarGoogleCalendar")
    .addSeparator()
    .addItem("⚙️ Crear triggers automáticos",    "crearTriggersAutomaticos")
    .addItem("👤 Agregar Admin a Personal",       "agregarAdmin")
    .addToUi();
}

// ============================================================
// SETUP — agregar Admin a hoja Personal (correr UNA vez)
// ============================================================

function agregarAdmin() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.hojaPersonal);
  if (!hoja) { Logger.log("Hoja Personal no existe"); return; }

  // Verificar si ya existe
  if (hoja.getLastRow() > 1) {
    var nombres = hoja.getRange(2, 2, hoja.getLastRow()-1, 1).getValues().flat().map(String);
    if (nombres.some(function(n){ return n.toLowerCase() === "admin"; })) {
      SpreadsheetApp.getActiveSpreadsheet().toast("Admin ya existe en Personal.", "Setup", 4);
      return;
    }
  }

  var fi = hoja.getLastRow() + 1;
  hoja.getRange(fi, 1, 1, 7).setValues([[true, "Admin", "2025", "michaelmgm1249@gmail.com", "", "", ""]]);
  hoja.getRange(fi, 3, 1, 1).setNumberFormat("@"); // PIN como texto
  hoja.getRange(fi, 1, 1, 7).setBackground("#fff9e6").setFontFamily("Arial").setFontSize(10);
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ Admin agregado a Personal (PIN: 2025).", "Setup", 5);
}

function crearTriggersAutomaticos() {
  for (var t of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger("sincronizarCalendarios").timeBased().everyHours(6).create();
  ScriptApp.newTrigger("sincronizarGoogleCalendar").timeBased().everyHours(2).create();
  ScriptApp.newTrigger("autoCompletarAseosPasados").timeBased().atHour(22).everyDays(1).create();
  SpreadsheetApp.getActiveSpreadsheet()
    .toast("✅ Triggers creados (Airbnb c/6h, Calendar c/2h, Auto-completar 10PM)", "Triggers", 6);
}
