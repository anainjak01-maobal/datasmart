/* DataSmart · cálculos de la agenda. Funciones puras: reciben citas y servicios, devuelven números. */
(function (w) {
  "use strict";
  var X = w.DS, norm = X.norm, sum = X.sum, ORDEN = X.ORDEN;
  var ATENDIDA = "atendida";

  function analizar(citas, servicios, opt) {
    opt = opt || {};
    var rows = citas.filter(function (c) { return c.fecha && (!opt.desde || c.fecha >= opt.desde) && (!opt.hasta || c.fecha <= opt.hasta); });
    var att = rows.filter(function (c) { return norm(c.estado) === ATENDIDA; });
    var noll = rows.filter(function (c) { return norm(c.estado) !== ATENDIDA; });
    var A = { rows: rows, att: att, n: rows.length, nAtt: att.length, nNoll: noll.length };
    A.ing = sum(att, function (c) { return c.precio; });
    A.costo = sum(att, function (c) { return c.costo; });
    A.margen = A.ing - A.costo;
    A.pct = A.ing ? A.margen / A.ing : 0;
    var fechas = {}; rows.forEach(function (c) { fechas[c.fecha] = 1; });
    A.fechas = Object.keys(fechas).sort(); A.nDias = A.fechas.length;
    A.desde = A.fechas[0] || ""; A.hasta = A.fechas[A.nDias - 1] || "";

    /* por servicio: solo citas atendidas, ordenadas por margen */
    var S = {};
    att.forEach(function (c) {
      var k = c.servicio, o = S[k] || (S[k] = { servicio: c.servicio, citas: 0, ing: 0, costo: 0, margen: 0 });
      o.citas++; o.ing += c.precio; o.costo += c.costo; o.margen += c.precio - c.costo;
    });
    A.servicios = Object.keys(S).map(function (k) { var o = S[k]; o.mpc = o.citas ? o.margen / o.citas : 0; o.pctMargen = A.margen ? o.margen * 100 / A.margen : 0; return o; })
      .sort(function (a, b) { return b.margen - a.margen; });
    A.topServicio = A.servicios[0] || null;
    A.bajoMargen = A.servicios.length ? A.servicios.slice().sort(function (a, b) { return a.mpc - b.mpc; })[0] : null;

    /* por día de la semana (atendidas) y cuántas veces apareció ese día en el periodo */
    A.dow = {}; ORDEN.forEach(function (d) { A.dow[d] = { ing: 0, citas: 0, fechas: {} }; });
    att.forEach(function (c) { var d = X.dayName(c.fecha), o = A.dow[d]; if (!o) return; o.ing += c.precio; o.citas++; o.fechas[c.fecha] = 1; });
    A.diaTop = ORDEN.filter(function (d) { return A.dow[d].citas; }).sort(function (a, b) { return A.dow[b].ing - A.dow[a].ing; })[0] || "";

    /* por tipo de clienta: nueva o ya venía */
    A.tipo = {};
    att.forEach(function (c) { var k = c.tipo, o = A.tipo[k] || (A.tipo[k] = { citas: 0, ing: 0, margen: 0 }); o.citas++; o.ing += c.precio; o.margen += c.precio - c.costo; });
    Object.keys(A.tipo).forEach(function (k) { A.tipo[k].ipc = A.tipo[k].ing / A.tipo[k].citas; });

    /* por cómo llegó: cuántas citas no llegaron */
    A.llegada = {};
    rows.forEach(function (c) { var k = c.llegada, o = A.llegada[k] || (A.llegada[k] = { citas: 0, noll: 0 }); o.citas++; if (norm(c.estado) !== ATENDIDA) o.noll++; });
    A.wa = A.llegada["WhatsApp"] || { citas: 0, noll: 0 };
    A.sinCita = { citas: 0, noll: 0 };
    Object.keys(A.llegada).forEach(function (k) { if (k !== "WhatsApp") { A.sinCita.citas += A.llegada[k].citas; A.sinCita.noll += A.llegada[k].noll; } });

    /* lista de citas no llegadas, para la visualización */
    A.nollList = noll;
    return A;
  }

  /* Lectura en frases: cada una con su cifra. Se usa en el tablero y en la presentación. */
  function lecturas(A) {
    var L = [];
    if (!A.n) return L;
    if (A.topServicio && A.bajoMargen && A.topServicio.servicio !== A.bajoMargen.servicio) {
      L.push({ t: "<b>" + X.esc(A.topServicio.servicio) + "</b> deja " + X.money(A.topServicio.mpc) + " de margen por cita. <b>" + X.esc(A.bajoMargen.servicio) + "</b> deja " + X.money(A.bajoMargen.mpc) + ". La silla que más se llena no siempre es la que más paga." });
    }
    if (A.wa.citas) L.push({ t: "De las citas por WhatsApp no llegó <b>" + A.wa.noll + " de " + A.wa.citas + "</b>. Las que llegan sin cita o por una vecina no faltaron ninguna vez (" + A.sinCita.noll + " de " + A.sinCita.citas + ")." });
    if (A.tipo["Ya venía"] && A.tipo["Nueva"]) L.push({ t: "Una clienta que ya venía deja en promedio <b>" + X.money(A.tipo["Ya venía"].ipc) + "</b> por cita. Una nueva, <b>" + X.money(A.tipo["Nueva"].ipc) + "</b>. La diferencia viene sobre todo del servicio que pide cada una." });
    if (A.diaTop) L.push({ t: "El <b>" + A.diaTop.toLowerCase() + "</b> es el día que más ingresa: " + X.money(A.dow[A.diaTop].ing) + " en el periodo." });
    return L;
  }

  w.DSA = { analizar: analizar, lecturas: lecturas };
})(window);
