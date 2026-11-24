// Acciones de Pipe Bot en el Centro de Mando (solo para Felipe, con su cuenta de administrador):
// - redactar publicaciones (Mercado Libre/Falabella e Instagram) como en Publicaciones
// - generar el certificado/factura de Éxito con los datos del cliente (lo descarga el Generador facturas Éxito)
// - responder con IA (Claude, por el Worker) lo que las respuestas fijas no cubren
import { firebaseConfig, ADMIN_UID, FIREBASE_VERSION, SKYDROPX_URL } from "../mensajeria/config.js";
import { promptPublicacion, CIERRE_BASE, CONSOLAS, leerJSON } from "../publicaciones/redactor.js?v=20261124a";
import { buscar, productos, leer, garantiaDe, formatoPesos as cop, escapar as esc, METODOS } from "./motor.js";

const { initializeApp, getApps, getApp } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
const { getAuth, onAuthStateChanged, signInWithEmailAndPassword } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`);
const auth = getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
const listoAuth = new Promise(ok => { const off = onAuthStateChanged(auth, u => { off(); ok(u); }); });
const BASE = new URL(".", import.meta.url).href;

export async function sesion() { await listoAuth; const u = auth.currentUser; return u && u.uid === ADMIN_UID ? u : null; }
export async function entrar(correo, clave) { await signInWithEmailAndPassword(auth, correo, clave); return sesion(); }
export function formularioEntrada() {
  return `<h3>Entra con tu cuenta</h3><p>Para redactar, hacer facturas o responder con IA necesito tu cuenta de administrador.</p>
    <form class="pb-login" data-login><input type="email" name="c" placeholder="Correo" autocomplete="username" required><input type="password" name="k" placeholder="Contraseña" autocomplete="current-password" required><button type="submit" class="pb-cta">Entrar</button><p class="nota" data-loginerr></p></form>`;
}

async function claude(texto) {
  const u = await sesion(); if (!u) throw { code: "auth" };
  const r = await fetch(SKYDROPX_URL.replace(/\/+$/, ""), {
    method: "POST", headers: { Authorization: "Bearer " + await u.getIdToken(), "Content-Type": "application/json" },
    body: JSON.stringify({ metodo: "REDACTAR", prompt: texto.slice(0, 11900) })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw { code: "server", message: j.error || ("HTTP " + r.status) };
  return String(j.texto || "");
}
const copiable = (titulo, texto) => `<h3>${esc(titulo)}</h3><div class="pb-texto">${esc(texto).replace(/\n/g, "<br>")}</div><p><button type="button" class="pb-cta" data-copiar="${esc(texto)}">Copiar</button></p>`;

// ══ Intenciones ══
export function intencion(q) {
  const n = leer(q).n;
  if (/\b(descripcion|descripciones|publicacion|publicaciones|publicar|instagram|post|copy)\b/.test(n)) return "publicacion";
  if (/\b(factura|facturas|certificado|certificados)\b/.test(n)) return "factura";
  return null;
}

// ══ Publicaciones ══
const CONSOLA_DE = { ps4: "PS4", ps5: "PS5", switch: "SWITCH", switch2: "SWITCH 2" };
export async function publicacion(q) {
  const r = leer(q);
  // El juego: el del catálogo que mejor coincide, o lo escrito quitando las palabras del pedido
  const limpio = q.replace(/\b(hazme|haz|crea|crear|genera|generar|redacta|redactar|escribe|escribir|dame|una?|la|el|de|del|para|descripci[oó]n(es)?|publicaci[oó]n(es)?|publicar|instagram|post|copy|mercado ?libre|falabella|[eé]xito|marketplace|y|texto)\b/gi, " ").replace(/\s+/g, " ").trim();
  const hits = buscar(limpio || q, 3);
  const p = hits.length === 1 ? hits[0] : (hits.find(h => r.plat && norm(h.p) === r.plat) || null);
  const consolaK = p ? String(p.p).toUpperCase() : (CONSOLA_DE[r.plat] || "PS5");
  const consola = (CONSOLAS.find(c => c.k === consolaK) || {}).nombre || consolaK;
  const juego = p ? p.n : limpio;
  if (!juego) return `<p>¿De qué juego? Ejemplo: <i>descripción de Mario Kart 8 Deluxe Switch</i>.</p>`;
  const d = { juego, version: "ESTANDAR", consola, estado: "NUEVO Y SELLADO", dispo: "inmediata", precio: p ? cop(p.v) : "", notas: "" };
  const t = await claude(promptPublicacion(d));
  const i = t.indexOf("{"), k = t.lastIndexOf("}");
  const g = leerJSON(t); if (!g) throw { code: "json" };
  const nombre = String(g.nombre_oficial || juego).toUpperCase();
  const cab = [nombre + " - ESTANDAR", "CONSOLA: " + consola, "ESTADO: NUEVO Y SELLADO"];
  if (g.genero) cab.push("GÉNERO: " + String(g.genero).toUpperCase());
  if (g.fecha_lanzamiento) cab.push("FECHA DE LANZAMIENTO: " + String(g.fecha_lanzamiento).toUpperCase());
  const mk = cab.join("\n") + "\n\n" + String(g.descripcion || "").trim();
  let cierre = null; try { cierre = localStorage.getItem("pg_cierre2"); } catch {}
  const ig = [nombre + " " + consolaK + " - NUEVO🕹" + (p ? " Precio: " + cop(p.v) + "💰" : ""), String(g.instagram || "").trim(), cierre || CIERRE_BASE()].filter(Boolean).join("\n\n");
  return `<p class="nota">${esc(nombre)} · ${esc(consola)}${p ? " · " + cop(p.v) : ""}. Revisa los textos antes de publicar; para cambiar versión, estado o notas usa <a href="${BASE}../publicaciones/">Publicaciones</a>.</p>`
    + copiable("Mercado Libre / Falabella", mk) + copiable("Instagram", ig);
}
const norm = t => String(t || "").toLowerCase().replace(/\s/g, "");

// ══ Factura / certificado de Éxito (paso a paso) ══
export const factura = { paso: null, d: {} };
const PLATAFORMAS = ["ÉXITO ATENDIDO", "APP ÉXITO", "ÉXITO MOVILIDAD", "ÉXITO.COM"];
export function facturaInicio() {
  factura.paso = "cliente"; factura.d = { items: [] };
  return `<h3>Factura / certificado de Éxito 🧾</h3><p>Pega los datos del cliente como te llegaron (nombre, dirección, cédula y ciudad, cada uno en su línea).</p>`;
}
function garantiaFactura(items) {
  const g = items.map(i => i.g).filter(Boolean);
  if (g.some(x => /año/.test(x))) return "GARANTÍA 1 AÑO DIRECTAMENTE CON LA MARCA.";
  if (g.some(x => /6 meses/.test(x))) return "GARANTÍA 6 MESES POR DEFECTOS DE FÁBRICA.";
  if (g.some(x => /3 meses/.test(x))) return "GARANTÍA 3 MESES POR DEFECTOS DE FÁBRICA.";
  return "GARANTÍA 1 MES POR DEFECTOS DE FÁBRICA.";
}
const fmtMiles = n => Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");
export function facturaPaso(q, botones) {
  const d = factura.d;
  if (factura.paso === "cliente") {
    if (q.split(/\n|,/).filter(x => x.trim()).length < 2 && q.length < 15) return `<p>Pega todos los datos del cliente: nombre, dirección, cédula y ciudad.</p>`;
    d.pegar = q; factura.paso = "orden";
    return `<p>¿Cuál es el <b>número de orden</b> de Éxito?</p>`;
  }
  if (factura.paso === "orden") {
    const v = q.replace(/[^\dA-Za-z-]/g, ""); if (v.length < 4) return `<p>Escribe el número de orden.</p>`;
    d.orden = v; factura.paso = "plataforma";
    return `<p>¿Por cuál plataforma de Éxito fue la venta?</p>${botones(PLATAFORMAS.map(p => ["fx-plat:" + p, p]))}`;
  }
  if (factura.paso === "producto" || factura.paso === "mas") {
    if (factura.paso === "mas" && /^(no|listo|ya|ninguno|eso es todo|generar?)$/i.test(q.trim())) return facturaFin();
    const hits = buscar(q, 4);
    if (!hits.length) return `<p>No encontré “${esc(q)}” en el catálogo. Escríbelo de otra forma.</p>`;
    if (hits.length > 1) return `<p>¿Cuál de estos?</p>${botones(hits.map(h => ["fx-prod:" + esc(h.n + "|" + h.p), `${h.n} · ${h.p} · ${cop(h.v)}`]))}`;
    return facturaAgregar(hits[0]);
  }
  if (factura.paso === "precio" || (factura.paso === "confirmaPrecio" && /\d{3}/.test(q))) {
    const v = parseInt(q.replace(/\D/g, ""), 10); if (!v) return `<p>Escribe el precio de venta en Éxito (solo números).</p>`;
    d.items[d.items.length - 1].u = fmtMiles(v); factura.paso = "mas";
    return masProductos(botones);
  }
  return null;
}
export function facturaBoton(a, botones) {
  const d = factura.d;
  if (a.startsWith("fx-plat:")) { d.metodo = a.slice(8); factura.paso = "producto"; return `<p>¿Qué <b>producto</b> compró? Escribe el nombre (por ejemplo <i>Minecraft PS5</i>).</p>`; }
  if (a.startsWith("fx-prod:")) { const [n, p] = a.slice(8).split("|"); const x = productos().find(y => y.n === n && y.p === p); return x ? facturaAgregar(x) : `<p>No lo encontré.</p>`; }
  if (a === "fx-precio-ok") { factura.paso = "mas"; return masProductos(botones); }
  if (a === "fx-precio-otro") { factura.paso = "precio"; return `<p>¿A qué precio se vendió en Éxito?</p>`; }
  if (a === "fx-fin") return facturaFin();
  if (a === "fx-mas") { factura.paso = "mas"; return `<p>Escribe el siguiente producto.</p>`; }
  return null;
}
let _botones = null;
function facturaAgregar(x) {
  const d = factura.d;
  d.items.push({ q: "1", p: `${x.n} ${x.p}`.slice(0, 80) + " - NUEVO", u: fmtMiles(x.v), g: garantiaDe(x) });
  factura.paso = "confirmaPrecio";
  return `<p>Agregué <b>${esc(x.n)} · ${esc(x.p)}</b> a ${cop(x.v)} (precio del catálogo). ¿Ese fue el precio de la venta en Éxito?</p>${_botones([["fx-precio-ok", "Sí, ese precio"], ["fx-precio-otro", "Otro precio"]])}`;
}
function masProductos(botones) {
  if (factura.d.items.length >= 4) return facturaFin();
  return `<p>¿Algún otro producto en la misma orden? Escríbelo, o genera la factura.</p>${botones([["fx-fin", "Generar factura ✓"]])}`;
}
function facturaFin() {
  const d = factura.d;
  const hoy = new Date(); const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const datos = { pegar: d.pegar, fecha, orden: d.orden, metodo: d.metodo, garantia: garantiaFactura(d.items), items: d.items.map(({ q, p, u }) => ({ q, p, u })), t: Date.now() };
  try { localStorage.setItem("pg_cert_auto", JSON.stringify(datos)); } catch {}
  factura.paso = null; factura.d = {};
  window.open(BASE + "../certificados/", "_blank");
  return `<h3>Factura lista ✅</h3><p>Abrí el Generador facturas Éxito con los datos: se descarga el PDF solo. Revísalo antes de enviarlo. Si no se abrió, <a href="${BASE}../certificados/" target="_blank" rel="noopener">ábrelo aquí</a>.</p><table>${datos.items.map(i => `<tr><td>${esc(i.p)}</td><td>$${esc(i.u)}</td></tr>`).join("")}</table><p class="nota">Orden ${esc(datos.orden)} · ${esc(datos.metodo)} · ${esc(datos.garantia)}</p>`;
}
export function usarBotones(f) { _botones = f; }

// ══ Conexión con el chat (widget del Centro de Mando y página asistente/) ══
let pendiente = null; // lo que se repite después de entrar
const ESCRIBIENDO = `<span class="pb-escribiendo"><i></i><i></i><i></i></span>`;
async function ejecutar(fn, poner) {
  const caja = poner(ESCRIBIENDO, "bot");
  try { caja.innerHTML = await fn(); }
  catch (e) {
    if (e && e.code === "auth") { pendiente = fn; caja.innerHTML = formularioEntrada(); caja.querySelector("input")?.focus(); }
    else caja.innerHTML = `<p>No pude completarlo${e?.code === "json" ? ": la IA respondió en otro formato. Inténtalo de nuevo" : e?.message ? ": " + esc(e.message) : ""}.</p>`;
  }
  caja.scrollIntoView({ block: "end" });
}
// Devuelve true si la pregunta la atiende una acción (publicación, factura o IA)
export function manejar(q, poner) {
  if (factura.paso && /^\s*(cancelar|salir|olvidalo|olvídalo)\s*$/i.test(q)) { factura.paso = null; factura.d = {}; poner(`<p>Listo, cancelé la factura.</p>`, "bot"); return true; }
  if (factura.paso) { const h = facturaPaso(q, _botones); if (h) { poner(h, "bot"); return true; } }
  const it = intencion(q);
  if (it === "factura") { poner(facturaInicio(), "bot"); return true; }
  if (it === "publicacion") { ejecutar(() => publicacion(q), poner); return true; }
  return false;
}
// Si las respuestas fijas no entendieron, pregunta a la IA (o lo ofrece si no encontró un producto)
export function respaldo(q, html, poner) {
  if (/Pregúntame por un juego, un precio/.test(html)) { ejecutar(() => preguntarIA(q), poner); return true; }
  if (/No encontré “/.test(html)) { poner(html + `<p>${_botones([["ia", "Preguntarle a la IA"]]).replace('data-accion="ia"', `data-accion="ia" data-q="${esc(q)}"`)}</p>`, "bot"); return true; }
  return false;
}
export function conectar(chat, poner) {
  chat.addEventListener("click", async e => {
    const c = e.target.closest("[data-copiar]");
    if (c) {
      const t = c.dataset.copiar;
      try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement("textarea"); a.value = t; document.body.append(a); a.select(); try { document.execCommand("copy"); } catch {} a.remove(); }
      const o = c.textContent; c.textContent = "Copiado ✓"; setTimeout(() => { c.textContent = o; }, 1500); return;
    }
    const b = e.target.closest("[data-accion]"); if (!b) return;
    const a = b.dataset.accion;
    if (a === "ia") { b.disabled = true; poner(esc(b.dataset.q), "yo"); return ejecutar(() => preguntarIA(b.dataset.q), poner); }
    if (a.startsWith("fx-")) { poner(esc(b.textContent), "yo"); const h = facturaBoton(a, _botones); if (h) poner(h, "bot"); }
  });
  chat.addEventListener("submit", async e => {
    const f = e.target.closest("[data-login]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const err = f.querySelector("[data-loginerr]"); err.textContent = ""; f.querySelector("button").disabled = true;
    try {
      const u = await entrar(f.c.value.trim(), f.k.value);
      if (!u) { err.textContent = "Esta cuenta no tiene acceso."; f.querySelector("button").disabled = false; return; }
      f.closest(".pb-msg, .msg").innerHTML = `<p>✅ Entraste.</p>`;
      if (pendiente) { const fn = pendiente; pendiente = null; ejecutar(fn, poner); }
    } catch { err.textContent = "Correo o contraseña incorrectos."; f.querySelector("button").disabled = false; }
  });
}

// ══ IA para lo demás ══
export async function preguntarIA(q) {
  const r = leer(q);
  const hits = buscar(q, 15);
  const lista = (hits.length ? hits : productos().filter(p => p.disp).slice(0, 60)).map(p => `- ${p.n} · ${p.p} · ${cop(p.v)} · ${p.disp ? "disponible" : "agotado"}${garantiaDe(p) ? " · garantía " + garantiaDe(p) : ""}`).join("\n");
  const prompt = `Eres Pipe Bot, el asistente interno de Felipe, dueño de PIPE GAMES (tienda 100% virtual de videojuegos en Bogotá, Colombia). Respóndele a Felipe en español, breve y directo (máximo 120 palabras), sin inventar datos: usa solo lo que está aquí; si no está, dilo.

Datos del negocio:
- Productos nuevos y sellados de fábrica; videojuegos físicos. Garantía: juegos 1 mes por defectos de fábrica; consolas 6 meses; accesorios 3 meses; iPad y MacBook 1 año con la marca.
- Envíos: Bogotá, Chía y Soacha domicilio $10.000 (mismo día antes de las 3:00 p. m.); resto del país por Envía o Interrapidísimo, 1 a 3 días hábiles; consolas, parlantes e iPads fuera de Bogotá se cotizan en Skydropx (tarifa + $2.000, redondeado a los mil de arriba).
- Pagos: ${METODOS.map(m => m.t + " (" + m.d + ")").join("; ")}. Addi y Sistecrédito no aplican desde $1.000.000. No hay contra entrega.
- Horario: lunes a sábado 9:30 a. m. a 7:00 p. m. WhatsApp 311 883 6995.
- Herramientas: Panel de despacho, Calculadoras (Mercado Libre: (neto+9.600)/0,82; Falabella: (neto+8.800)/0,83; Éxito: neto/0,881), Publicaciones, Generador facturas Éxito.

Productos relacionados del catálogo (stock al día):
${lista}

Pregunta de Felipe: ${q}`;
  const t = await claude(prompt);
  return `<p>${esc(t.trim()).replace(/\n/g, "<br>")}</p><p class="nota">Respuesta con IA (Claude). Verifica los datos importantes.</p>`;
}
