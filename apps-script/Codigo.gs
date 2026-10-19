/* DataSmart · Registro de citas.
   Recibe una cita desde la página (POST), toma el precio y el costo de la hoja Servicios
   y la agrega al final de la hoja Agenda. Las hojas deben llamarse exactamente "Servicios" y "Agenda". */

var HOJA_SERVICIOS = "Servicios";
var HOJA_AGENDA = "Agenda";
var LLEGADAS = ["WhatsApp", "Llegó sin cita", "Vecina"];
var CLIENTES = ["Nueva", "Ya venía"];
var ESTADOS = ["Atendida", "No llegó"];
var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/* Clave del equipo: la usan el tablero, el registro de citas y la lectura de las hojas.
   CAMBIARLA antes de implementar. */
var CLAVE = "cambia-esta-clave";

/* GET ?hoja=servicios|agenda&clave=...  -> la hoja en CSV (solo con la clave correcta).
   Sin parámetros responde que el registro está activo (para probar la URL). */
function doGet(e) {
  var q = (e && e.parameter) || {};
  if (!q.hoja) return salida({ ok: true, mensaje: "Registro de DataSmart activo." });
  if (String(q.clave || "") !== CLAVE) return salida({ ok: false, error: "Clave incorrecta." });
  var nombres = { servicios: HOJA_SERVICIOS, agenda: HOJA_AGENDA };
  var h = nombres[q.hoja];
  if (!h) return salida({ ok: false, error: "Hoja no válida." });
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(h);
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
    if (String(p.clave || "") !== CLAVE) return salida({ ok: false, error: "Clave incorrecta. Revisa la clave del equipo." });
    return salida(registrarCita(p));
  } catch (err) {
    return salida({ ok: false, error: "No se pudo registrar: " + err });
  } finally {
    lock.releaseLock();
  }
}

function registrarCita(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hS = ss.getSheetByName(HOJA_SERVICIOS), hA = ss.getSheetByName(HOJA_AGENDA);
  if (!hS || !hA) return { ok: false, error: "Faltan las hojas Servicios y Agenda. Revisa que se llamen exactamente así." };

  var fecha = String(p.fecha || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "La fecha no es válida." };
  var hoy = Utilities.formatDate(new Date(), "America/Bogota", "yyyy-MM-dd");
  if (fecha > hoy) return { ok: false, error: "No se pueden registrar citas de un día que todavía no llegó." };
  if (fecha < "2020-01-01") return { ok: false, error: "La fecha es demasiado antigua." };

  var servicio = String(p.servicio || "").trim();
  var llegada = String(p.llegada || "").trim(), cliente = String(p.cliente || "").trim(), estado = String(p.estado || "").trim();
  if (LLEGADAS.indexOf(llegada) < 0) return { ok: false, error: "Indica cómo llegó la clienta." };
  if (CLIENTES.indexOf(cliente) < 0) return { ok: false, error: "Indica si es clienta nueva o ya venía." };
  if (ESTADOS.indexOf(estado) < 0) return { ok: false, error: "Indica si la cita fue atendida o no llegó." };

  /* Precio y costo salen de la hoja Servicios, no de la página */
  var sv = hS.getDataRange().getValues(), precio = null, costo = 0;
  for (var i = 1; i < sv.length; i++) {
    if (String(sv[i][0]).trim().toLowerCase() === servicio.toLowerCase()) { precio = Number(sv[i][1]); costo = Number(sv[i][2]) || 0; break; }
  }
  if (precio === null) return { ok: false, error: "El servicio “" + servicio + "” no está en la hoja Servicios." };

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
