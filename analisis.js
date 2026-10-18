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

  /* Prueba exacta de Fisher (dos colas) para una tabla 2x2: probabilidad de ver una diferencia así por azar */
  function fisher(a, b, c, d) {
    var N = a + b + c + d, K = a + c, n = a + b, lf = [0], i;
    for (i = 1; i <= N; i++) lf[i] = lf[i - 1] + Math.log(i);
    function lnC(x, y) { return lf[x] - lf[y] - lf[x - y]; }
    function P(k) { return Math.exp(lnC(K, k) + lnC(N - K, n - k) - lnC(N, n)); }
    var pObs = P(a), p = 0;
    for (var k = Math.max(0, n - (N - K)); k <= Math.min(n, K); k++) { var pk = P(k); if (pk <= pObs * (1 + 1e-7)) p += pk; }
    return Math.min(1, p);
  }

  /* Cuatro preguntas que la agenda puede responder, cada una con su muestra y su veredicto */
  function preguntas(A, servicios) {
    var out = [], pctTxt = function (p) { return (Math.round(p * 1000) / 10).toString().replace(".", ",") + " %"; };

    /* 1. ¿Qué servicio deja más plata en total? */
    var s1 = A.servicios[0], s2 = A.servicios[1];
    out.push({
      q: "¿Qué servicio deja más plata?",
      r: s1 ? "<b>" + X.esc(s1.servicio) + "</b>, con " + X.money(s1.margen) + " de margen en " + s1.citas + " citas. Por cita deja " + X.money(s1.mpc) + "." : "No hay citas atendidas.",
      m: A.servicios.map(function (s) { return X.esc(s.servicio) + ": " + s.citas + (s.citas === 1 ? " cita" : " citas"); }).join(" · "),
      v: "si",
      n: "El margen por cita sale de la lista de precios y costos: no cambia de una cita a otra. Lo que sí cambia es cuántas veces se pide cada servicio, y por eso el total es lo que hay que mirar." + (s2 ? " Segundo lugar: " + X.esc(s2.servicio) + ", " + X.money(s2.margen) + "." : "")
    });

    /* 2. ¿El día de la semana cambia el ingreso? */
    var ocurrencias = ORDEN.map(function (d) { return { d: d, n: Object.keys(A.dow[d].fechas).length, ing: A.dow[d].ing }; });
    var conDatos = ocurrencias.filter(function (o) { return o.n; }), minOcur = conDatos.length ? Math.min.apply(null, conDatos.map(function (o) { return o.n; })) : 0;
    var max = ocurrencias.slice().sort(function (a, b) { return b.ing - a.ing; })[0], min = ocurrencias.filter(function (o) { return o.n; }).sort(function (a, b) { return a.ing - b.ing; })[0];
    var suficiente = minOcur >= 4;
    out.push({
      q: "¿El día de la semana cambia cuánto se vende?",
      r: max && min ? "Entre " + max.d.toLowerCase() + " (" + X.money(max.ing) + ") y " + min.d.toLowerCase() + " (" + X.money(min.ing) + ") hay diferencia. " + (suficiente ? "" : "Pero cada día aparece solo " + minOcur + " " + (minOcur === 1 ? "vez" : "veces") + " en el periodo.") : "No hay datos.",
      m: ocurrencias.filter(function (o) { return o.n; }).map(function (o) { return o.d.slice(0, 3) + " " + o.n + "×"; }).join(" · "),
      v: suficiente ? "si" : "no",
      n: suficiente ? "Cada día tiene al menos 4 apariciones: la diferencia ya merece revisarse." : "Con 2 veces por día, una semana con mucha o poca venta puede explicar toda la diferencia. Hace falta un mes para afirmar que el sábado pesa más."
    });

    /* 3. ¿Llegar por WhatsApp se relaciona con no llegar? */
    var w = A.wa, sc = A.sinCita, pv = null;
    if (w.citas && sc.citas) pv = fisher(w.noll, w.citas - w.noll, sc.noll, sc.citas - sc.noll);
    out.push({
      q: "¿Las citas por WhatsApp faltan más?",
      r: w.citas ? "De WhatsApp no llegaron " + w.noll + " de " + w.citas + " (" + pctTxt(w.noll / w.citas) + "). Las que llegaron sin cita o por una vecina: " + sc.noll + " de " + sc.citas + "." : "No hay citas por WhatsApp.",
      m: "WhatsApp " + w.citas + " · sin cita o vecina " + sc.citas,
      v: pv !== null && pv < 0.05 ? "si" : "no",
      n: pv === null ? "Falta comparar dos grupos con datos." : (pv < 0.05 ? "Es poco probable que una diferencia así sea azar (" + pctTxt(pv) + ")." : "Si no hubiera relación, una diferencia así se vería " + pctTxt(pv) + " de las veces. Todavía no se puede afirmar: hace falta más agenda.")
    });

    /* 4. ¿Las clientas que ya venían dejan más? */
    var ya = A.tipo["Ya venía"], nu = A.tipo["Nueva"], difSrv = null, comunes = [];
    if (ya && nu) {
      var prec = {};
      A.att.forEach(function (c) { var k = c.servicio, t = c.tipo; prec[k] = prec[k] || {}; prec[k][t] = prec[k][t] || { n: 0, s: 0 }; prec[k][t].n++; prec[k][t].s += c.precio; });
      var sumD = 0, sumW = 0;
      Object.keys(prec).forEach(function (k) {
        var g = prec[k]; if (!g["Ya venía"] || !g["Nueva"]) return;
        var a = g["Ya venía"].s / g["Ya venía"].n, b = g["Nueva"].s / g["Nueva"].n, wgt = g["Ya venía"].n + g["Nueva"].n;
        comunes.push(k); sumD += (a - b) * wgt; sumW += wgt;
      });
      difSrv = sumW ? sumD / sumW : null;
    }
    out.push({
      q: "¿Las clientas que ya venían dejan más?",
      r: ya && nu ? "Por cita, " + X.money(ya.ipc) + " contra " + X.money(nu.ipc) + " de las nuevas." : "Falta uno de los dos grupos.",
      m: comunes.length ? "Servicios que pidieron ambas: " + comunes.map(function (x) { return X.esc(x); }).join(", ") : "Ningún servicio con los dos grupos",
      v: difSrv === null ? "no" : (Math.abs(difSrv) >= 1000 ? "si" : "no"),
      n: difSrv === null ? "No hay servicios que hayan pedido las dos. No se puede separar el efecto de la clienta." : (Math.abs(difSrv) < 1000 ? "Dentro de cada mismo servicio, la diferencia es de " + X.money(Math.abs(difSrv)) + ". La diferencia viene de qué servicio pide cada grupo, no de la clienta." : "Dentro del mismo servicio también hay diferencia de " + X.money(Math.abs(difSrv)) + " por cita.")
    });
    return out;
  }

  /* Revisiones de calidad sobre toda la agenda (sin importar el periodo elegido) */
  function calidad(citas, servicios) {
    var out = [], cat = {}, ids = {}, dupl = 0, bad = { estado: 0, llegada: 0, tipo: 0, servicio: 0, catalogo: 0, fecha: 0 };
    servicios.forEach(function (s) { cat[norm(s.servicio)] = s; });
    citas.forEach(function (c) {
      if (ids[c.id]) dupl++; ids[c.id] = 1;
      if (!c.fecha) bad.fecha++;
      if ([ATENDIDA, "no llego"].indexOf(norm(c.estado)) < 0) bad.estado++;
      if (["whatsapp", "llego sin cita", "vecina"].indexOf(norm(c.llegada)) < 0) bad.llegada++;
      if (["nueva", "ya venia"].indexOf(norm(c.tipo)) < 0) bad.tipo++;
      var s = cat[norm(c.servicio)];
      if (!s) bad.servicio++;
      else if (s.precio !== c.precio || s.costo !== c.costo) bad.catalogo++;
    });
    function add(ok, t, bien, mal) { out.push({ nivel: ok ? "ok" : "revisar", titulo: t, detalle: ok ? bien : mal }); }
    add(!bad.fecha, "Fechas legibles", "Todas las citas tienen fecha.", bad.fecha + " citas sin fecha legible.");
    add(!dupl, "Un número de cita, una fila", "No hay números de cita repetidos.", dupl + " citas con número repetido: suman dos veces.");
    add(!bad.estado, "Estado válido", "Todas las citas están como atendidas o no llegó.", bad.estado + " citas con un estado que no existe.");
    add(!bad.llegada, "Cómo llegó, categorías fijas", "Solo WhatsApp, sin cita o vecina.", bad.llegada + " citas con otra forma de llegar. Se corrige a una de las tres.");
    add(!bad.tipo, "Nueva o ya venía", "Todas las citas dicen si la clienta es nueva o ya venía.", bad.tipo + " citas sin esa marca.");
    add(!bad.servicio, "Servicio en el catálogo", "Todos los servicios están en la hoja Servicios.", bad.servicio + " citas con un servicio fuera de la lista. Agrégalo a Servicios o corrige el nombre.");
    add(!bad.catalogo, "Precio y costo iguales al catálogo", "Cada cita tiene el precio y el costo de su servicio.", bad.catalogo + " citas con precio o costo distinto al de la lista. Si cambió el precio, actualiza Servicios.");
    var fechas = {}; citas.forEach(function (c) { if (c.fecha) fechas[c.fecha] = 1; });
    var ks = Object.keys(fechas).sort(), falt = [];
    if (ks.length) for (var i = 0, d = ks[0]; d <= ks[ks.length - 1] && i < 60; i++, d = X.addDays(ks[0], i)) { if (!fechas[d] && X.dayName(d) !== "Domingo") falt.push(X.dayName(d) + " " + X.fmtDate(d)); }
    add(!falt.length, "Días abiertos sin citas", "Cada día abierto entre la primera y la última cita tiene registro. Los domingos están cerrados y no cuentan.", falt.length + " días sin citas: " + falt.slice(0, 5).join(", ") + ". Confirma si no hubo clientes o si faltó anotar.");
    return out;
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

  w.DSA = { analizar: analizar, lecturas: lecturas, preguntas: preguntas, calidad: calidad, fisher: fisher };
})(window);
