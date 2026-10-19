/* DataSmart · Registro de citas y reservas.
   - Solicitud pública (sin clave): la clienta reserva desde reserva.html. Queda en la hoja Solicitudes como Pendiente.
   - Con clave del equipo: registrar una cita, confirmar una solicitud (Atendida / No llegó) o cancelarla.
   El precio y el costo salen siempre de la hoja Servicios. Las hojas se llaman exactamente
   "Servicios", "Agenda" y "Solicitudes" (esta última se crea sola si no existe). */

var HOJA_SERVICIOS = "Servicios";
var HOJA_AGENDA = "Agenda";
var HOJA_SOLICITUDES = "Solicitudes";
var SOL_CABECERA = ["ID", "Fecha pedida", "Servicio", "Tipo", "Estado", "Cita", "Creada"];
var LLEGADAS = ["WhatsApp", "Llegó sin cita", "Vecina"];
var CLIENTES = ["Nueva", "Ya venía"];
var ESTADOS = ["Atendida", "No llegó"];
var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/* Clave del equipo: la usan el tablero y el registro de citas.
   CAMBIARLA antes de implementar. */
var CLAVE = "cambia-esta-clave";

/* GET ?servicios=1                -> servicio y precio (público, sin costos).
   GET ?hoja=servicios|agenda|solicitudes&clave=... -> la hoja en CSV (solo con la clave).
   GET sin parámetros              -> confirma que el registro está activo. */
function doGet(e) {
  var q = (e && e.parameter) || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (q.servicios) {
    var sv = ss.getSheetByName(HOJA_SERVICIOS);
    if (!sv) return salida({ ok: false, error: "Falta la hoja Servicios." });
    var v = sv.getDataRange().getValues(), out = [["Servicio", "Precio"]];
    for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim()) out.push([v[i][0], v[i][1]]);
    return csvSalida(aCsv(out));
  }
  if (!q.hoja) return salida({ ok: true, mensaje: "Registro de DataSmart activo." });
  if (String(q.clave || "") !== CLAVE) return salida({ ok: false, error: "Clave incorrecta." });
  var nombres = { servicios: HOJA_SERVICIOS, agenda: HOJA_AGENDA, solicitudes: HOJA_SOLICITUDES };
  var h = nombres[q.hoja];
  if (!h) return salida({ ok: false, error: "Hoja no válida." });
  var hoja = q.hoja === "solicitudes" ? hojaSolicitudes(ss) : ss.getSheetByName(h);
  if (!hoja) return salida({ ok: false, error: "Falta la hoja " + h + " en el archivo." });
  return csvSalida(aCsv(hoja.getDataRange().getValues()));
}

function csvSalida(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.CSV); }
function celdaCsv(v) {
  if (v instanceof Date) v = Utilities.formatDate(v, "America/Bogota", "yyyy-MM-dd");
  var t = String(v == null ? "" : v);
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
function aCsv(filas) { return filas.map(function (f) { return f.map(celdaCsv).join(","); }).join("\n") + "\n"; }

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return salida({ ok: false, error: "Hay otro registro en curso. Intenta de nuevo en unos segundos." });
  try {
    var p = JSON.parse(e.postData.contents);
    if (p.accion === "solicitud") return salida(registrarSolicitud(p));
    if (String(p.clave || "") !== CLAVE) return salida({ ok: false, error: "Clave incorrecta. Revisa la clave del equipo." });
    if (p.accion === "atender") return salida(atenderSolicitud(p));
    if (p.accion === "cancelar") return salida(cambiarSolicitud(p, "Cancelada"));
    return salida(registrarCita(p));
  } catch (err) {
    return salida({ ok: false, error: "No se pudo registrar: " + err });
  } finally {
    lock.releaseLock();
  }
}

function hoyBogota() { return Utilities.formatDate(new Date(), "America/Bogota", "yyyy-MM-dd"); }

/* Busca el servicio en la hoja Servicios (sin distinguir mayúsculas). Devuelve precio y costo, o null. */
function buscarServicio(ss, nombre) {
  var hS = ss.getSheetByName(HOJA_SERVICIOS); if (!hS) return null;
  var sv = hS.getDataRange().getValues();
  for (var i = 1; i < sv.length; i++) {
    if (String(sv[i][0]).trim().toLowerCase() === String(nombre || "").trim().toLowerCase()) {
      return { nombre: String(sv[i][0]).trim(), precio: Number(sv[i][1]), costo: Number(sv[i][2]) || 0 };
    }
  }
  return null;
}

function hojaSolicitudes(ss) {
  var h = ss.getSheetByName(HOJA_SOLICITUDES);
  if (!h) {
    h = ss.insertSheet(HOJA_SOLICITUDES);
    h.getRange(1, 1, 1, SOL_CABECERA.length).setValues([SOL_CABECERA]).setFontWeight("bold");
    h.setFrozenRows(1);
  }
  return h;
}

/* Reserva pública: queda como Pendiente hasta que el equipo la confirme. No guarda datos personales. */
function registrarSolicitud(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fecha = String(p.fecha || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "La fecha no es válida." };
  var hoy = hoyBogota();
  if (fecha < hoy) return { ok: false, error: "La fecha ya pasó. Elige un día de hoy en adelante." };
  if (fecha > Utilities.formatDate(new Date(Date.now() + 60 * 86400000), "America/Bogota", "yyyy-MM-dd")) return { ok: false, error: "Solo se puede reservar con 60 días de anticipación." };
  var sv = buscarServicio(ss, p.servicio);
  if (!sv) return { ok: false, error: "Ese servicio no está disponible." };
  var tipo = String(p.tipo || "").trim();
  if (CLIENTES.indexOf(tipo) < 0) return { ok: false, error: "Indica si es tu primera vez o si ya nos visitaste." };

  var h = hojaSolicitudes(ss), ids = h.getRange(1, 1, Math.max(h.getLastRow(), 1), 1).getValues(), max = 0;
  for (var k = 0; k < ids.length; k++) { var m = String(ids[k][0]).match(/^S(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  var id = "S" + (max < 9 ? "0" : "") + (max + 1);
  var d = new Date(fecha + "T12:00:00"), fin = Math.max(h.getLastRow(), 1) + 1;
  h.getRange(fin, 1, 1, SOL_CABECERA.length).setValues([[id, d, sv.nombre, tipo, "Pendiente", "", new Date()]]);
  h.getRange(fin, 2).setNumberFormat("dd/mm/yyyy");
  return { ok: true, id: id };
}

function buscarSolicitud(h, id) {
  var v = h.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === String(id || "").trim()) return { fila: i + 1, datos: v[i] };
  return null;
}

/* Confirma una reserva: registra la cita real en Agenda con sus datos y la marca como Registrada. */
function atenderSolicitud(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), h = hojaSolicitudes(ss);
  var s = buscarSolicitud(h, p.solicitud);
  if (!s) return { ok: false, error: "No encuentro la solicitud " + p.solicitud + "." };
  if (String(s.datos[4]) !== "Pendiente") return { ok: false, error: "La solicitud " + p.solicitud + " ya está " + s.datos[4] + "." };
  var f = s.datos[1] instanceof Date ? Utilities.formatDate(s.datos[1], "America/Bogota", "yyyy-MM-dd") : String(s.datos[1]);
  var r = registrarCita({ fecha: f, servicio: s.datos[2], llegada: p.llegada || "WhatsApp", cliente: s.datos[3], estado: p.estado });
  if (!r.ok) return r;
  h.getRange(s.fila, 5, 1, 2).setValues([["Registrada", r.id]]);
  return r;
}

function cambiarSolicitud(p, estado) {
  var h = hojaSolicitudes(SpreadsheetApp.getActiveSpreadsheet());
  var s = buscarSolicitud(h, p.solicitud);
  if (!s) return { ok: false, error: "No encuentro la solicitud " + p.solicitud + "." };
  if (String(s.datos[4]) !== "Pendiente") return { ok: false, error: "La solicitud " + p.solicitud + " ya está " + s.datos[4] + "." };
  h.getRange(s.fila, 5).setValue(estado);
  return { ok: true };
}

function registrarCita(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hA = ss.getSheetByName(HOJA_AGENDA);
  if (!ss.getSheetByName(HOJA_SERVICIOS) || !hA) return { ok: false, error: "Faltan las hojas Servicios y Agenda. Revisa que se llamen exactamente así." };

  var fecha = String(p.fecha || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "La fecha no es válida." };
  if (fecha > hoyBogota()) return { ok: false, error: "No se pueden registrar citas de un día que todavía no llegó." };
  if (fecha < "2020-01-01") return { ok: false, error: "La fecha es demasiado antigua." };

  var llegada = String(p.llegada || "").trim(), cliente = String(p.cliente || "").trim(), estado = String(p.estado || "").trim();
  if (LLEGADAS.indexOf(llegada) < 0) return { ok: false, error: "Indica cómo llegó la clienta." };
  if (CLIENTES.indexOf(cliente) < 0) return { ok: false, error: "Indica si es clienta nueva o ya venía." };
  if (ESTADOS.indexOf(estado) < 0) return { ok: false, error: "Indica si la cita fue atendida o no llegó." };

  var sv = buscarServicio(ss, p.servicio);
  if (!sv) return { ok: false, error: "El servicio “" + p.servicio + "” no está en la hoja Servicios." };
  var servicio = sv.nombre, precio = sv.precio, costo = sv.costo;

  /* Número de cita: el siguiente después del último C## que haya */
  var ids = hA.getRange(1, 1, Math.max(hA.getLastRow(), 1), 1).getValues(), max = 0;
  for (var k = 0; k < ids.length; k++) { var m = String(ids[k][0]).match(/^C(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  var id = "C" + (max < 9 ? "0" : "") + (max + 1);

  var atendida = estado === "Atendida";
  var ingreso = atendida ? precio : 0, costoCobrado = atendida ? costo : 0;
  var d = new Date(fecha + "T12:00:00");
  var fila = [id, d, DIAS[d.getDay()], servicio, llegada, cliente, estado, precio, costo, ingreso, costoCobrado, ingreso - costoCobrado];

  var fin = Math.max(hA.getLastRow(), 1) + 1;
  hA.getRange(fin, 1, 1, fila.length).setValues([fila]);
  hA.getRange(fin, 2).setNumberFormat("dd/mm/yyyy");
  hA.getRange(fin, 8, 1, 5).setNumberFormat("$#,##0");
  hA.getRange(fin, 12).setNumberFormat("$#,##0");

  return { ok: true, id: id, precio: ingreso, costo: costoCobrado, margen: ingreso - costoCobrado };
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
