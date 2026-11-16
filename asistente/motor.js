// Motor de Pipe Bot: responde con el catálogo (stock en vivo), las tarifas de envío y las fórmulas de pago y plataformas.
// Lo usan el asistente del Centro de Mando (burbuja abajo a la derecha) y la página asistente/.
import { METODOS_PAGO } from "../mensajeria/comun.js";
import * as T from "../mensajeria/tarifas-envio.js";
import { PRODUCTOS as PRODUCTOS_BASE } from "../mensajeria/productos-catalogo.js";
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cop = n => "$" + Math.round(n).toLocaleString("es-CO");
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
const METODOS = METODOS_PAGO.filter(m => m.id !== "contraentrega");
const MET = Object.fromEntries(METODOS.map(m => [m.id, m]));
const TOPE_CUOTAS = 1000000;

// ── Datos: catálogo con el stock en vivo (misma regla del catálogo y del panel) ──
let PROD = [], cargado = 0;
async function cargar() {
  let lista = PRODUCTOS_BASE, st = null;
  try { lista = (await import(`../mensajeria/productos-catalogo.js?t=${Date.now()}`)).PRODUCTOS || lista; } catch {}
  try { const r = await fetch(`../stock.json?_=${Date.now()}`, { cache: "no-store" }); if (r.ok) st = await r.json(); } catch {}
  const prod = st?.productos || {}, usar = Object.keys(prod).length >= 50;
  PROD = lista.map(p => {
    let disp = p.a;
    if (usar && p.k) { let c = prod[p.k]; if (c === undefined && p.e) c = 0; if (c !== undefined && c >= 0) disp = c > 0; }
    return { ...p, disp, t: norm(p.n), tp: norm(p.p).replace(/\s/g, "") };
  });
  cargado = Date.now();
  return PROD.filter(p => p.disp).length;
}

// ── Plataformas: fórmulas del Excel CALCULADORAS_PRECIOS (las mismas de Calculadoras) ──
const PLAT = {
  ml: { n: "Mercado Libre", precio: N => (N + 9600) / 0.82, neto: P => P - P * 0.16 - P * 0.16 * 0.15 - 9600 },
  fa: { n: "Falabella", precio: N => (N + 8800) / 0.83, neto: P => P - P * 0.02 - P * 0.15 - 8800 },
  ex: { n: "Éxito", precio: N => N / 0.881, neto: P => P - P * 0.10 - P * 0.10 * 0.19 }
};

// ── Lectura de la pregunta ──
const PLATAF = [["switch2", /\b(switch ?2|sw2|ns2)\b/], ["ps5", /\bps ?5\b|play ?5|playstation ?5/], ["ps4", /\bps ?4\b|play ?4|playstation ?4/], ["switch", /\b(switch|nintendo|sw|ns)\b/]];
const VACIAS = new Set("el la los las de del y o a en para por con que cual cuanto cuanta cuantos vale cuesta precio precios hay tienes tiene tenemos disponible disponibles stock juego juegos me un una dame dime quiero saber sobre envio envios domicilio flete costo valor al lo le se es mi su sus ps4 ps5 switch nintendo play playstation sw ns ns2 sw2 addi siste sistecredito tarjeta credito cuotas bold cobrar cobro total con mercado libre falabella exito ml publicar publico recibir neto ciudad municipio llega llegan enviar mandan mandar hacia hasta".split(" "));
function leer(q) {
  const n = norm(q), r = { n };
  r.plat = (PLATAF.find(([, rx]) => rx.test(n)) || [])[0] || null;
  if (/\baddi\b/.test(n)) r.metodo = "addi"; else if (/siste/.test(n)) r.metodo = "siste"; else if (/tarjeta|bold|credito/.test(n)) r.metodo = "tarjeta";
  if (/mercado ?libre|\bml\b/.test(n)) r.mk = "ml"; else if (/falabella/.test(n)) r.mk = "fa"; else if (/\bexito\b/.test(n)) r.mk = "ex";
  const montos = (q.match(/\$?\s?\d{1,3}(?:[.,]\d{3})+|\$?\s?\d{4,}/g) || []).map(x => parseInt(x.replace(/\D/g, ""), 10)).filter(v => v >= 1000 && !(v >= 1980 && v <= 2099)); // un año (God of War 2018) no es un valor
  r.monto = montos[0] || null;
  r.ciudad = ciudadEn(n, q);
  r.envio = /envi|domicil|flete|llega|mandan|despach|transportadora/.test(n);
  r.tema = /horario|hora |atienden|abren/.test(n) ? "horario" : /metodo|medios de pago|formas de pago|como pag/.test(n) ? "pagos" : /cuanto (se )?demora|tiempo de entrega|cuando llega|dias/.test(n) ? "tiempos" : /\bguia|rastre/.test(n) ? "rastreo" : /contacto|whatsapp|telefono|correo/.test(n) ? "contacto" : null;
  // Un número suelto cuenta (UFC 6, Mario Kart 8), salvo el 2 de "Switch 2"
  const tokens = n.split(" ").filter(w => (w.length >= 2 || /^\d$/.test(w)) && !VACIAS.has(w) && (!/^\d{4,}$/.test(w) || /^(19[89]\d|20\d\d)$/.test(w)) && !(w === "2" && r.plat === "switch2"));
  r.tokens = tokens.filter(w => !(r.ciudad && r.ciudad.palabras.includes(w)));
  return r;
}
// Municipio escrito en la pregunta: el nombre más largo que aparezca completo
function ciudadEn(n, q) {
  let mejor = null;
  for (const m of T.ENVIO_MUNI) {
    const k = m.k; if (!k || k.length < 4) continue;
    if ((" " + n + " ").includes(" " + k + " ") && (!mejor || k.length > mejor.k.length)) mejor = m;
  }
  if (!mejor) {
    for (const [alias, real] of Object.entries(T.ENVIO_ALIAS || {})) if (alias.length >= 3 && (" " + n + " ").includes(" " + alias + " ")) { const m = T.ENVIO_MUNI.find(x => x.k === real); if (m) { mejor = m; break; } }
  }
  if (!mejor) return null;
  const dup = T.ENVIO_MUNI.filter(x => x.k === mejor.k);
  const porDepto = dup.find(x => x.kd && (" " + n + " ").includes(" " + x.kd + " "));
  const elegido = porDepto || dup.sort((a, b) => (a.tar ? 0 : 1) - (b.tar ? 0 : 1))[0];
  return { m: elegido, varios: dup.length > 1 && !porDepto, palabras: [...mejor.k.split(" "), ...(porDepto ? porDepto.kd.split(" ") : [])] };
}
function buscarProductos(r) {
  if (!r.tokens.length) return [];
  let l = PROD.map(p => {
    const pal = p.t.split(" "), junto = p.t.replace(/ /g, "");
    let s = 0, palabra = false;
    for (const w of r.tokens) {
      let v = 0;
      if (pal.includes(w)) v = 2; else if (/^\d$/.test(w)) v = 0; else if (junto.includes(w)) v = 1.5; else if (p.t.includes(w)) v = 1; else if (w.length >= 5 && pal.some(x => x.startsWith(w.slice(0, 4)))) v = 0.5;
      if (v && !/^\d+$/.test(w)) palabra = true;
      s += v;
    }
    // Si se escribió alguna palabra, al menos una tiene que coincidir (un número solo no basta)
    if (r.tokens.some(w => !/^\d+$/.test(w)) && !palabra) s = 0;
    return { p, s };
  }).filter(x => x.s > 0);
  if (r.plat) l = l.filter(x => x.p.tp.replace(/\s/g, "") === r.plat || (r.plat === "switch" && x.p.tp === "switch"));
  if (!l.length) return [];
  const max = Math.max(...l.map(x => x.s));
  // Si algún producto tiene todas las palabras escritas, solo esos
  if (max >= 2 * r.tokens.length) l = l.filter(x => x.s >= max);
  return l.filter(x => x.s >= Math.max(max * 0.75, r.tokens.length >= 2 ? 2 : 1)).sort((a, b) => b.s - a.s || (b.p.disp - a.p.disp) || a.p.v - b.p.v).slice(0, 6).map(x => x.p);
}

// ── Respuestas ──
const fila = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
function preciosPago(base) {
  return METODOS.map(m => (m.credito && base >= TOPE_CUOTAS) ? fila(m.t.split(" · ")[0], "No aplica (desde $1.000.000)") : fila(m.t.split(" · ")[0], cop(m.calc(base)))).join("");
}
function envioTexto(m, esGrande, cli) {
  const e = T.envioDeCiudad(T.envEtiqueta(m));
  if (e.tipo === "local") return { valor: e.valor, html: `<p><b>${esc(e.ciudad)}</b>: domicilio <b>${cop(e.valor)}</b> con nuestro mensajero. Mismo día si compra antes de las 3:00 p. m.</p>` };
  if (esGrande && (e.tipo === "nacional" || e.tipo === "otro")) return { valor: null, html: cli ? `<p><b>${esc(e.ciudad)}</b>: para consolas, parlantes e iPads fuera de Bogotá, Chía y Soacha te confirmamos el valor del envío por <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a>.</p>` : `<p><b>${esc(e.ciudad)}</b>: consolas, parlantes e iPads fuera de Bogotá se cotizan en Skydropx (tarifa + $2.000, redondeado a los mil de arriba).</p>` };
  if (e.tipo === "nacional") {
    const ops = (e.opciones || []).filter(o => o.v).sort((a, b) => a.v - b.v);
    return { valor: ops[0].v, html: `<p><b>${esc(e.ciudad)}</b>: ${ops.map(o => `${esc(o.n)} <b>${cop(o.v)}</b>`).join(" · ")}. Entrega en 1 a 3 días hábiles.</p>` };
  }
  return { valor: null, html: cli ? `<p><b>${esc(e.ciudad)}</b>: sí enviamos. Te confirmamos el valor del envío por <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a>.</p>` : `<p><b>${esc(e.ciudad)}</b>: sí enviamos, pero no tiene tarifa fija. Cotízalo en Skydropx.</p>` };
}
// Ficha de un producto: precio con cada medio de pago y, para clientes, el botón para pedirlo
function ficha(p, cli) {
  // Al cliente no se le muestra precio de lo agotado
  if (cli && !p.disp) return `<h3>${esc(p.n)} · ${esc(p.p)} <span class="chip no">AGOTADO</span></h3><p>Actualmente está agotado. Pregúntanos por <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a> si llega pronto.</p>`;
  return `<h3>${esc(p.n)} · ${esc(p.p)} <span class="chip ${p.disp ? "ok" : "no"}">${p.disp ? "DISPONIBLE" : "AGOTADO"}</span></h3>
      <table>${fila("Precio (transferencia)", `<b>${cop(p.v)}</b>`)}${preciosPago(p.v).split("</tr>").slice(1).join("</tr>")}</table>${cli && p.disp ? `<p><button type="button" class="pb-cta" data-pedir="${esc(p.n)}|${esc(p.p)}">🛒 Agregar al pedido</button></p>` : ""}${cli && !p.disp ? `<p class="nota">Está agotado por ahora. Pregúntanos por <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a> si llega pronto.</p>` : ""}`;
}
// opts.modo === "cliente": versión para el catálogo; solo precios, disponibilidad, envíos, pagos, horario y contacto
const WA = "https://wa.me/573118836995";
function responder(q, opts = {}) {
  const cli = opts.modo === "cliente";
  const r = leer(q), partes = [];
  if (cli) {
    r.mk = null; // los precios de otras plataformas son internos
    if (/^\s*(pipe|asesor|humano|persona|felipe|hablar con alguien)\s*$/i.test(q) || /\b(asesor|humano|hablar con)\b/.test(r.n))
      return `<h3>¡Claro!</h3><p>Escríbenos por WhatsApp y te atendemos personalmente.</p><p><a class="pb-cta" href="${WA}" target="_blank" rel="noopener">Hablar por WhatsApp · 311 883 6995</a></p><p class="nota">Lunes a sábado de 9:30 a. m. a 7:00 p. m.</p>`;
  }
  // Temas generales
  if (r.tema === "horario") partes.push(`<h3>Horario</h3><p>Lunes a sábado de 9:30 a. m. a 7:00 p. m. Domingos y festivos no hay atención.</p>`);
  if (r.tema === "pagos") partes.push(`<h3>Medios de pago</h3><table>${METODOS.map(m => fila(esc(m.t), esc(m.d))).join("")}</table><p class="nota">Addi y Sistecrédito no aplican desde $1.000.000.</p>`);
  if (r.tema === "tiempos") partes.push(`<h3>Tiempos de entrega</h3><p>Bogotá, Chía y Soacha: mismo día si compra antes de las 3:00 p. m. Otras ciudades: 1 a 3 días hábiles por Envía o Interrapidísimo.</p>`);
  if (r.tema === "rastreo" && cli) partes.push(`<h3>Rastreo de tu pedido</h3><p>Consulta tu pedido con tu número de guía en <a href="https://pipegames.com.co/mensajeria/rastreo.html" target="_blank" rel="noopener">pipegames.com.co/mensajeria/rastreo.html</a>. Si tu envío es fuera de Bogotá, usa el número de guía de la transportadora que te enviamos.</p>`);
  else if (r.tema === "rastreo") partes.push(`<h3>Rastreo</h3><p>El cliente consulta su guía en <a href="https://pipegames.com.co/mensajeria/rastreo.html" target="_blank" rel="noopener">pipegames.com.co/mensajeria/rastreo.html</a>. Las guías nacionales se ven en Skydropx.</p>`);
  if (r.tema === "contacto") partes.push(cli ? `<h3>Contacto</h3><p><a class="pb-cta" href="${WA}" target="_blank" rel="noopener">WhatsApp 311 883 6995</a></p><p class="nota">Somos tienda 100% virtual: entregamos a domicilio en Bogotá, Chía y Soacha y enviamos a todo el país.</p>` : `<h3>Contacto</h3><p>WhatsApp 311 883 6995 · ventas@pipegames.com · Catálogo: <a href="https://pipegames.com.co/" target="_blank" rel="noopener">pipegames.com.co</a></p>`);

  // Productos
  const prods = r.tema ? [] : buscarProductos(r);
  const grande = prods.some(p => /\b(consola|parlante|ipad)\b/.test(p.t));
  if (prods.length === 1) {
    partes.push(ficha(prods[0], cli));
  } else if (prods.length > 1) {
    partes.push(`<h3>Encontré ${prods.length}${prods.length === 6 ? " o más" : ""}</h3>` + prods.map(p => (cli && !p.disp) ? `<div class="prod"><b>${esc(p.n)} · ${esc(p.p)}<span class="chip no">AGOTADO</span></b><span class="sub">Actualmente está agotado.</span></div>` : `<div class="prod" role="button" tabindex="0" data-ver="${esc(p.n)}|${esc(p.p)}"><b>${esc(p.n)} · ${esc(p.p)}<span class="chip ${p.disp ? "ok" : "no"}">${p.disp ? "DISPONIBLE" : "AGOTADO"}</span></b><span class="pr">${cop(p.v)}</span><span class="sub">Addi ${p.v >= TOPE_CUOTAS ? "no aplica" : cop(MET.addi.calc(p.v))} · Sistecrédito ${p.v >= TOPE_CUOTAS ? "no aplica" : cop(MET.siste.calc(p.v))} · Tarjeta ${cop(MET.tarjeta.calc(p.v))}</span></div>`).join("")
      + `<p class="nota">Toca uno para ver todos sus precios${cli ? " y pedirlo" : ""}.</p>`);
  }

  if (!prods.length && !r.tema && !r.mk && r.tokens.length && (r.ciudad || r.metodo || r.envio))
    partes.push(`<p>No encontré “${esc(r.tokens.join(" "))}”${r.plat ? " para " + esc(r.plat.toUpperCase()) : ""} en el catálogo.</p>`);

  // Envío
  let env = null;
  if (r.ciudad) {
    env = envioTexto(r.ciudad.m, grande, cli);
    partes.push(`<h3>Envío</h3>${env.html}${r.ciudad.varios ? `<p class="nota">Hay varios municipios con ese nombre; tomé ${esc(T.envEtiqueta(r.ciudad.m))}. Escribe el departamento si es otro.</p>` : ""}`);
  } else if (r.envio && !r.tema && !prods.length) {
    partes.push(`<h3>Envío</h3><p>Dime la ciudad o el municipio. Bogotá, Chía y Soacha: ${cop(T.ENVIO_LOCAL_VALOR)}. Ciudades principales: $16.000 por Envía o $18.000 por Interrapidísimo.</p>`);
  }

  // Total del pedido con envío y medio de pago
  const base = prods.length === 1 ? ((cli && !prods[0].disp) ? null : prods[0].v) : (r.monto && !r.mk ? r.monto : null);
  if (base && (r.metodo || (env && env.valor))) {
    const envio = env?.valor || 0, m = MET[r.metodo || "transf"];
    const tot = (m.credito && base >= TOPE_CUOTAS) ? null : m.calc(base + envio);
    partes.push(`<h3>Total ${m.id === "transf" ? "por transferencia" : "con " + esc(m.t.split(" · ")[0])}</h3><table>${fila(prods.length === 1 ? "Producto" : "Valor", cop(base))}${envio ? fila("Envío", cop(envio)) : ""}${tot != null && tot !== base + envio ? fila("Recargo", cop(tot - base - envio)) : ""}${fila("<b>Total a cobrar</b>", tot == null ? "No aplica desde $1.000.000" : `<b>${cop(tot)}</b>`)}</table>`);
  } else if (r.monto && !prods.length && !r.mk && !r.ciudad) {
    partes.push(`<h3>${cop(r.monto)} con cada medio de pago</h3><table>${preciosPago(r.monto)}</table>`);
  }

  // Plataformas (Mercado Libre, Falabella, Éxito)
  const mkBase = r.mk ? (prods.length === 1 ? prods[0].v : r.monto) : null;
  if (r.mk && mkBase) {
    const pl = PLAT[r.mk], publicar = /publico|publicad|vend[oi]|precio de venta/.test(r.n);
    if (publicar && !prods.length) partes.push(`<h3>${pl.n}</h3><table>${fila("Publicado a", cop(mkBase))}${fila("<b>Te queda</b>", `<b>${cop(pl.neto(mkBase))}</b>`)}</table>`);
    else partes.push(`<h3>${pl.n}</h3><table>${fila(prods.length === 1 ? "Para recibir el precio de la tienda" : "Para recibir", cop(mkBase))}${fila("<b>Publica a</b>", `<b>${cop(pl.precio(mkBase))}</b>`)}</table><p class="nota">Fórmula de tu Excel. Para el desglose completo abre <a href="../calculadoras/">Calculadoras</a>.</p>`);
  } else if (r.mk) partes.push(`<p>¿Con qué valor? Ejemplo: “mercado libre 110000” (lo que quieres recibir) o “publico en falabella a 184990”.</p>`);

  if (!partes.length) {
    if (r.tokens.length) partes.push(`<p>No encontré “${esc(r.tokens.join(" "))}” en el catálogo${r.plat ? " para " + esc(r.plat.toUpperCase()) : ""}. Prueba con otra parte del nombre${cli ? `, o pregúntanos por <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a>` : ""}.</p>`);
    else partes.push(`<p>Pregúntame por un juego, un precio, un envío o un medio de pago.</p>`);
  }
  return partes.join("");
}

export const disponibles = () => PROD.filter(p => p.disp).length;
export const desactualizado = () => Date.now() - cargado > 120000;
// Ficha de un producto elegido de una lista
function verProducto(n, p, opts = {}) {
  const x = PROD.find(y => y.n === n && y.p === p);
  return x ? ficha(x, opts.modo === "cliente") : "<p>Ese producto ya no está en el catálogo.</p>";
}
export { cargar, responder, verProducto };

// ── Para la compra guiada del catálogo ──
// Ciudad escrita por el cliente → etiqueta "Ciudad - Departamento" (o varias si el nombre se repite)
function ciudadCliente(texto) {
  const r = T.envBuscar(texto);
  if (r?.x) return { etiqueta: T.envEtiqueta(r.x) };
  if (r?.multi) return { multi: r.multi.slice(0, 6).map(m => T.envEtiqueta(m)) };
  const c = ciudadEn(norm(texto), texto);
  if (c && !c.varios) return { etiqueta: T.envEtiqueta(c.m) };
  if (c) return { multi: T.ENVIO_MUNI.filter(x => x.k === c.m.k).slice(0, 6).map(m => T.envEtiqueta(m)) };
  return null;
}
// Envío del pedido a esa ciudad (consolas, parlantes e iPads fuera de Bogotá, Chía y Soacha: por confirmar)
function envioCliente(etiqueta, nombres) {
  const e = T.envioDeCiudad(etiqueta), grande = (nombres || []).some(n => /\b(consola|parlante|ipad)\b/i.test(n));
  if (e.tipo === "local") return { valor: e.valor, texto: `Domicilio en ${e.ciudad}: ${cop(e.valor)} (mismo día si compras antes de las 3:00 p. m.)` };
  if (e.tipo === "nacional" && !grande) { const o = (e.opciones || []).filter(x => x.v).sort((a, b) => a.v - b.v)[0]; return { valor: o.v, texto: `Envío a ${e.ciudad} por ${o.n}: ${cop(o.v)} (1 a 3 días hábiles)` }; }
  return { valor: 0, porConfirmar: true, texto: `Envío a ${e.ciudad}: te confirmamos el valor por WhatsApp` };
}
export { ciudadCliente, envioCliente, METODOS, TOPE_CUOTAS, cop as formatoPesos, esc as escapar };
