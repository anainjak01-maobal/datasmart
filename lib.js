/* DataSmart · funciones comunes: leer las hojas, formatear, enviar citas al registro. */
(function (w) {
  "use strict";
  var CFG = w.DS_CONFIG || {};

  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "$" + Math.round(+n || 0).toLocaleString("es-CO"); }
  function toNum(v) { var s = String(v == null ? "" : v).replace(/[^\d-]/g, ""); return s ? parseInt(s, 10) : 0; }
  function sum(list, fn) { return list.reduce(function (a, x) { return a + fn(x); }, 0); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parseDate(v) {
    var s = String(v == null ? "" : v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    return "";
  }
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fmtDate(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (+m[3]) + " " + MESES[+m[2] - 1] : "—"; }
  var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var ORDEN = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  function dayName(iso) { var d = new Date(iso + "T12:00:00"); return isNaN(d) ? "" : DIAS[d.getDay()]; }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function parseCSV(t) {
    var rows = [], row = [], cur = "", q = false, i, ch;
    t = String(t || "").replace(/^﻿/, "");
    for (i = 0; i < t.length; i++) {
      ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.join("").trim() !== ""; });
  }

  var ALIAS = {
    servicios: { servicio: ["servicio"], precio: ["precio"], costo: ["costo insumos", "costo"] },
    solicitudes: { id: ["id"], fecha: ["fecha pedida", "fecha"], servicio: ["servicio"], tipo: ["tipo"], estado: ["estado"], cita: ["cita"] },
    agenda: { id: ["id"], fecha: ["fecha"], servicio: ["servicio"], llegada: ["como llego"], tipo: ["tipo"], estado: ["estado"], precio: ["precio"], costo: ["costo insumos", "costo"] }
  };
  function findCol(headers, aliases) {
    var i, j;
    for (j = 0; j < aliases.length; j++) for (i = 0; i < headers.length; i++) if (headers[i] === aliases[j]) return i;
    return -1;
  }
  function toObjects(kind, csv) {
    var rows = parseCSV(csv);
    if (rows.length < 2) return { rows: [], missing: [] };
    var headers = rows[0].map(norm), map = {}, missing = [];
    Object.keys(ALIAS[kind]).forEach(function (k) { map[k] = findCol(headers, ALIAS[kind][k]); });
    var required = kind === "servicios" ? ["servicio", "precio"] : kind === "solicitudes" ? ["fecha", "servicio", "estado"] : ["fecha", "servicio", "estado", "precio"];
    required.forEach(function (k) { if (map[k] < 0) missing.push(ALIAS[kind][k][0]); });
    var out = rows.slice(1).map(function (r) {
      var o = {}; Object.keys(map).forEach(function (k) { o[k] = map[k] >= 0 ? String(r[map[k]] == null ? "" : r[map[k]]).trim() : ""; }); return o;
    }).filter(function (o) { return kind === "servicios" ? o.servicio : o.fecha; });
    return { rows: out, missing: missing };
  }
  function cleanServicios(list) { return list.map(function (o) { return { servicio: o.servicio, precio: toNum(o.precio), costo: toNum(o.costo) }; }); }
  function cleanCitas(list) {
    return list.map(function (o) {
      return { id: o.id, fecha: parseDate(o.fecha), servicio: o.servicio, llegada: o.llegada || "No indicado", tipo: o.tipo || "No indicado", estado: o.estado, precio: toNum(o.precio), costo: toNum(o.costo) };
    });
  }
  function fetchCsv(url) {
    var u = url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();
    return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
  }

  /* Devuelve { servicios, citas, modo: "demo"|"hojas", avisos: [] } */
  function loadData() {
    var H = CFG.HOJAS || {}, D = w.DS_DEMO;
    function demo(avisos) { return { servicios: cleanServicios(D.servicios.map(function (s) { return { servicio: s.servicio, precio: s.precio, costo: s.costo }; })), citas: cleanCitas(D.citas.map(function (c) { return { id: c.id, fecha: c.fecha, servicio: c.servicio, llegada: c.llegada, tipo: c.tipo, estado: c.estado, precio: c.precio, costo: c.costo }; })), modo: "demo", avisos: avisos || [] }; }
    if (!H.servicios && !H.agenda) return Promise.resolve(demo());
    if (!(H.servicios && H.agenda)) return Promise.resolve(demo(["Faltan enlaces en config.js: se necesitan los dos (servicios y agenda). Se muestran datos de demostración."]));
    return Promise.all([fetchCsv(H.servicios), fetchCsv(H.agenda)]).then(function (t) {
      var a = toObjects("servicios", t[0]), b = toObjects("agenda", t[1]), avisos = [];
      [["Servicios", a], ["Agenda", b]].forEach(function (x) { if (x[1].missing.length) avisos.push("En la hoja " + x[0] + " no encuentro la columna: " + x[1].missing.join(", ") + "."); });
      return { servicios: cleanServicios(a.rows), citas: cleanCitas(b.rows), modo: "hojas", avisos: avisos };
    }).catch(function () { return demo(["No se pudo leer la hoja de Google. Revisa que esté publicada en la web en formato CSV. Mientras tanto se muestran datos de demostración, NO los reales."]); });
  }

  /* Envía una cita al script. Siempre resuelve: { ok, ... } */
  function registrar(payload) {
    payload.clave = claveActual;
    if (!CFG.REGISTRO) return Promise.resolve({ ok: false, sinConfig: true });
    if (!/\/exec$/.test(CFG.REGISTRO)) return Promise.resolve({ ok: false, error: "El enlace de REGISTRO en config.js debe terminar en /exec." });
    return fetch(CFG.REGISTRO, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .catch(function () { return null; })
      .then(function (r) {
        if (!r) return { ok: false, error: "No llegó respuesta del script. Revisa en Apps Script: Implementar, Administrar implementaciones, que el acceso sea “Cualquier persona”." };
        return r.text().then(function (t) {
          try { return JSON.parse(t); }
          catch (e) { return { ok: false, error: "El script respondió algo que no es un resultado. Revisa que el acceso sea “Cualquier persona” y que la URL termine en /exec." }; }
        });
      });
  }

  /* ---- Acceso del equipo con clave ---- */
  var CLAVE_KEY = "datasmart-clave", claveActual = "";
  function leerClave() { try { return localStorage.getItem(CLAVE_KEY) || ""; } catch (e) { return ""; } }
  function guardarClave(c) { try { localStorage.setItem(CLAVE_KEY, c); } catch (e) {} }
  function olvidarClave() { try { localStorage.removeItem(CLAVE_KEY); } catch (e) {} }

  /* Pide las hojas al script con la clave. Rechaza con Error("clave"), Error("sinregistro"), Error("servidor:texto") o Error("red"). */
  function loadEquipo(clave) {
    var R = CFG.REGISTRO;
    if (!R) return Promise.reject(new Error("sinregistro"));
    var sep = R.indexOf("?") < 0 ? "?" : "&";
    function get(h) {
      return fetch(R + sep + "hoja=" + h + "&clave=" + encodeURIComponent(clave) + "&t=" + Date.now(), { cache: "no-store" })
        .catch(function () { throw new Error("red"); })
        .then(function (r) { if (!r.ok) throw new Error("red"); return r.text(); })
        .then(function (t) {
          if (/^\s*\{/.test(t)) {
            var j = {}; try { j = JSON.parse(t); } catch (e) {}
            if (/clave/i.test(j.error || "")) throw new Error("clave");
            throw new Error("servidor:" + (j.error || "Respuesta no válida."));
          }
          return t;
        });
    }
    return Promise.all([get("servicios"), get("agenda"), get("solicitudes")]).then(function (t) {
      var a = toObjects("servicios", t[0]), b = toObjects("agenda", t[1]), c = toObjects("solicitudes", t[2]), avisos = [];
      [["Servicios", a], ["Agenda", b]].forEach(function (x) { if (x[1].missing.length) avisos.push("En la hoja " + x[0] + " no encuentro la columna: " + x[1].missing.join(", ") + "."); });
      claveActual = clave;
      return { servicios: cleanServicios(a.rows), citas: cleanCitas(b.rows), solicitudes: c.rows, modo: "hojas", avisos: avisos };
    });
  }

  /* Pública: lista de servicios y precios (sin costos). */
  function loadServicios() {
    var R = CFG.REGISTRO;
    if (!R) return Promise.reject(new Error("sinregistro"));
    var sep = R.indexOf("?") < 0 ? "?" : "&";
    return fetch(R + sep + "servicios=1&t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("red"); return r.text(); })
      .then(function (t) { if (/^\s*\{/.test(t)) throw new Error("red"); return { servicios: cleanServicios(toObjects("servicios", t).rows) }; });
  }

  /* Reserva pública: el script la guarda como Pendiente. Devuelve { ok, id } o { ok:false, error }. */
  function enviarSolicitud(payload) {
    if (!CFG.REGISTRO) return Promise.resolve({ ok: false, sinConfig: true });
    payload.accion = "solicitud";
    return fetch(CFG.REGISTRO, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.text(); }).then(function (t) { return JSON.parse(t); })
      .catch(function () { return { ok: false, error: "No se pudo guardar la reserva." }; });
  }

  /* Acciones del equipo sobre una reserva: "atender" (con estado Atendida / No llegó) o "cancelar". */
  function solicitudAccion(accion, payload) {
    if (!CFG.REGISTRO) return Promise.resolve({ ok: false, error: "Falta REGISTRO en config.js." });
    payload.accion = accion; payload.clave = claveActual;
    return fetch(CFG.REGISTRO, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.text(); }).then(function (t) { return JSON.parse(t); })
      .catch(function () { return { ok: false, error: "No se pudo conectar. Intenta de nuevo." }; });
  }

  /* Muestra #contenido solo con la clave correcta. onOk(datos) se llama al entrar. */
  function acceso(onOk) {
    var $ = function (id) { return document.getElementById(id); };
    var acc = $("acceso"), cont = $("contenido"), salir = $("salir"), form = $("acc-form"), inp = $("clave"), msg = $("acc-msg"), btn = $("acc-btn");
    function mostrar() { acc.hidden = true; cont.hidden = false; if (salir) salir.hidden = false; }
    function pedir(m) { acc.hidden = false; cont.hidden = true; if (salir) salir.hidden = true; msg.textContent = m || ""; inp.focus(); }
    function mensaje(err) {
      if (err.message === "clave") return "La clave no es correcta.";
      if (err.message === "sinregistro") return "Falta conectar el script de registro (REGISTRO en config.js).";
      if (err.message.indexOf("servidor:") === 0) return err.message.slice(8);
      return "No se pudo conectar con la hoja. Revisa tu conexión e intenta de nuevo.";
    }
    function entrar(clave) { return loadEquipo(clave).then(function (d) { guardarClave(clave); return d; }); }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = inp.value.trim(); if (!c) return;
      btn.disabled = true; msg.textContent = "Revisando la clave…";
      entrar(c).then(function (d) { btn.disabled = false; inp.value = ""; mostrar(); onOk(d); },
        function (err) { btn.disabled = false; pedir(mensaje(err)); });
    });
    if (salir) salir.addEventListener("click", function () { olvidarClave(); location.reload(); });
    var guardada = leerClave();
    if (guardada) { msg.textContent = "Cargando…"; entrar(guardada).then(function (d) { mostrar(); onOk(d); }, function (err) { pedir(mensaje(err)); }); }
    else pedir("");
  }

  w.DS = { loadEquipo: loadEquipo, loadServicios: loadServicios, enviarSolicitud: enviarSolicitud, solicitudAccion: solicitudAccion, acceso: acceso, norm: norm, esc: esc, money: money, toNum: toNum, sum: sum, today: today, parseDate: parseDate, fmtDate: fmtDate, dayName: dayName, addDays: addDays, ORDEN: ORDEN, parseCSV: parseCSV, loadData: loadData, registrar: registrar, CFG: CFG };
})(window);
