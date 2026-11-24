// Pipe Bot: asistente flotante (abajo a la derecha). Se carga con <script type="module" src="../asistente/widget.js"></script>
// Usa el motor de asistente/motor.js: catálogo con stock en vivo, tarifas de envío y fórmulas de pago y plataformas.
import { cargar, responder, verProducto, desactualizado, disponibles, ciudadCliente, envioCliente, METODOS, TOPE_CUOTAS, formatoPesos as cop } from "./motor.js";

const BASE = new URL(".", import.meta.url).href; // carpeta asistente/
// ?modo=cliente: versión del catálogo (solo precios, disponibilidad, envíos, pagos, horario y contacto)
const CLI = new URL(import.meta.url).searchParams.get("modo") === "cliente";
// Acciones internas (publicaciones, facturas e IA): solo en el Centro de Mando; se cargan al abrir el bot
let ACC = null;
const acciones = () => ACC || (ACC = import("./acciones.js?v=20261123c").then(m => { m.usarBotones(botones); m.conectar(chat, poner); return m; }));
// Robot original de Pipe Games: cabeza de consola portátil con pantalla, ojos de píxel, antena con luz y cruceta en el pecho
const ROBOT = `
<svg viewBox="0 0 120 130" aria-hidden="true" class="pb-robot">
  <defs>
    <linearGradient id="pbMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4a52"/><stop offset=".55" stop-color="#26262b"/><stop offset="1" stop-color="#151518"/></linearGradient>
    <linearGradient id="pbPlata" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#a9a9b0"/></linearGradient>
    <radialGradient id="pbLuz"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9ff5cf"/><stop offset="1" stop-color="#3ecf8e" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="pb-cuerpo">
    <line x1="60" y1="8" x2="60" y2="24" stroke="url(#pbPlata)" stroke-width="3" stroke-linecap="round"/>
    <circle class="pb-antena" cx="60" cy="8" r="7" fill="url(#pbLuz)"/>
    <circle cx="60" cy="8" r="3" fill="#ffffff"/>
    <rect x="10" y="44" width="10" height="22" rx="4" fill="url(#pbPlata)"/>
    <rect x="100" y="44" width="10" height="22" rx="4" fill="url(#pbPlata)"/>
    <rect x="16" y="22" width="88" height="66" rx="16" fill="url(#pbMetal)" stroke="url(#pbPlata)" stroke-width="3"/>
    <rect x="26" y="32" width="68" height="44" rx="9" fill="#0a0a0c" stroke="#3a3a42" stroke-width="2"/>
    <g class="pb-ojos" fill="#f4f4f5">
      <rect x="40" y="44" width="11" height="11" rx="2"/>
      <rect x="69" y="44" width="11" height="11" rx="2"/>
    </g>
    <path d="M50 64 h4 v3 h12 v-3 h4" fill="none" stroke="#f4f4f5" stroke-width="3" stroke-linejoin="round"/>
    <rect x="36" y="92" width="48" height="30" rx="10" fill="url(#pbMetal)" stroke="url(#pbPlata)" stroke-width="2.5"/>
    <path d="M57 99h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="url(#pbPlata)"/>
    <circle cx="76" cy="101" r="2.6" fill="#3ecf8e"/>
  </g>
</svg>`;

const css = `
.pb-panel[hidden], .pb-globo[hidden] { display: none !important; }
.pb-boton { position: fixed; right: max(18px, env(safe-area-inset-right, 0px)); bottom: max(18px, env(safe-area-inset-bottom, 0px)); z-index: 900;
  width: 82px; height: 82px; border-radius: 50%; border: 1px solid rgba(255,255,255,.22); cursor: pointer; padding: 3px 5px 2px;
  background: radial-gradient(circle at 50% 35%, #2c2c31, #0e0e10 70%); box-shadow: 0 10px 28px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08); }
.pb-boton:focus-visible { outline: 2px solid #d6d6da; outline-offset: 3px; }
.pb-robot { width: 100%; height: 100%; display: block; overflow: visible; }
.pb-globo { position: fixed; right: max(100px, calc(env(safe-area-inset-right, 0px) + 100px)); bottom: max(34px, calc(env(safe-area-inset-bottom, 0px) + 34px)); z-index: 900;
  background: #f4f4f5; color: #111; font: 600 13.5px/1.3 'Barlow', Arial, sans-serif; padding: 9px 12px; border-radius: 12px 12px 4px 12px; box-shadow: 0 8px 20px rgba(0,0,0,.5); max-width: 200px; }
.pb-panel { position: fixed; right: max(16px, env(safe-area-inset-right, 0px)); bottom: max(104px, calc(env(safe-area-inset-bottom, 0px) + 104px)); z-index: 901;
  width: min(390px, calc(100vw - 32px)); height: min(580px, calc(100vh - 140px)); display: grid; grid-template-rows: auto minmax(0, 1fr) auto;
  background: #0d0d0f; border: 1px solid rgba(255,255,255,.18); border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.7); color: #f4f4f5; font: 15px/1.5 'Barlow', Arial, sans-serif; }
.pb-cab { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: linear-gradient(180deg, #2c2c31, #151518); border-bottom: 1px solid rgba(255,255,255,.1); }
.pb-cab .pb-mini { width: 40px; height: 40px; flex: none; }
.pb-cab img { height: 22px; width: auto; display: block; }
.pb-cab small { display: block; color: #9a9aa2; font-size: 12px; }
.pb-cab .pb-esp { flex: 1; min-width: 0; }
.pb-cab button { background: transparent; border: 1px solid rgba(255,255,255,.22); color: #f4f4f5; border-radius: 8px; width: 34px; height: 34px; font-size: 18px; cursor: pointer; }
.pb-chat { overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.pb-msg { max-width: 94%; padding: 9px 12px; border-radius: 14px; overflow-wrap: anywhere; font-size: 14.5px; }
.pb-yo { align-self: flex-end; background: #2b2b31; border-bottom-right-radius: 4px; }
.pb-bot { align-self: flex-start; background: linear-gradient(180deg, #232327, #151518); border: 1px solid rgba(255,255,255,.09); border-bottom-left-radius: 4px; display: grid; gap: 7px; }
.pb-bot h3 { font: 400 15px/1.25 'Russo One', 'Arial Black', sans-serif; margin: 0; }
.pb-bot p { margin: 0; } .pb-bot .nota { color: #9a9aa2; font-size: 12.5px; } .pb-bot a { color: #d6d6da; }
.pb-bot .prod { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; padding: 7px 0; border-top: 1px solid rgba(255,255,255,.1); }
.pb-bot .prod:first-of-type { border-top: 0; }
.pb-bot .prod[data-ver] { cursor: pointer; border-radius: 8px; margin: 0 -6px; padding: 7px 6px; }
.pb-bot .prod[data-ver]:hover, .pb-bot .prod[data-ver]:focus-visible { background: rgba(255,255,255,.07); outline: none; }
.pb-bot .prod[data-ver] b::after { content: " ›"; color: #9a9aa2; }
.pb-bot .pr { font: 400 15px 'Russo One', sans-serif; text-align: right; }
.pb-bot .sub { color: #9a9aa2; font-size: 12.5px; grid-column: 1 / -1; }
.pb-bot .chip { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; border-radius: 999px; padding: 1px 7px; margin-left: 6px; vertical-align: 1px; }
.pb-bot .chip.ok { background: rgba(62,207,142,.15); color: #3ecf8e; } .pb-bot .chip.no { background: rgba(255,123,123,.14); color: #ff7b7b; }
.pb-bot table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.pb-bot td { padding: 3px 0; border-top: 1px solid rgba(255,255,255,.09); }
.pb-bot td:last-child { text-align: right; white-space: nowrap; padding-left: 10px; font-variant-numeric: tabular-nums; }
.pb-sug { display: flex; flex-wrap: wrap; gap: 6px; }
.pb-sug button[disabled] { opacity: .45; cursor: not-allowed; }
.pb-sug button { font: 500 12.5px/1.2 'Barlow', Arial, sans-serif; color: #f4f4f5; background: #0c0c0e; border: 1px solid rgba(255,255,255,.22); border-radius: 999px; padding: 6px 10px; cursor: pointer; }
.pb-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid rgba(255,255,255,.1); background: #0d0d0f; }
.pb-form textarea { resize: none; max-height: 140px; line-height: 1.35; overflow-y: auto; }
.pb-form input, .pb-form textarea { flex: 1; min-width: 0; font: 16px 'Barlow', Arial, sans-serif; color: #f4f4f5; background: #202024; border: 1px solid rgba(255,255,255,.22); border-radius: 12px; padding: 10px 12px; }
.pb-form button { font: 400 14px 'Russo One', sans-serif; background: #d6d6da; color: #0a0a0c; border: 0; border-radius: 12px; padding: 0 14px; cursor: pointer; }
.pb-cta { display: inline-block; font: 700 14px/1.2 'Barlow', Arial, sans-serif; color: #0a0a0c !important; background: #f4f4f5; border: 0; border-radius: 10px; padding: 9px 14px; text-decoration: none; cursor: pointer; }
/* En el catálogo: encima de la barra de botones de abajo (Proceso, Simulador, Rastreo) */
.pb-cliente.pb-boton { width: 64px; height: 64px; bottom: calc(env(safe-area-inset-bottom, 0px) + 58px); right: max(14px, env(safe-area-inset-right, 0px)); }
.pb-cliente.pb-globo { right: max(88px, calc(env(safe-area-inset-right, 0px) + 88px)); bottom: calc(env(safe-area-inset-bottom, 0px) + 72px); }
.pb-cliente.pb-panel { bottom: calc(env(safe-area-inset-bottom, 0px) + 132px); z-index: 9400; height: min(560px, calc(100vh - 160px)); }
@media (max-width: 520px) { .pb-cliente.pb-panel { height: min(600px, calc(100vh - 150px)); } }
.pb-escribiendo { display: inline-flex; gap: 4px; } .pb-escribiendo i { width: 6px; height: 6px; border-radius: 50%; background: #9a9aa2; }
@media (prefers-reduced-motion: no-preference) {
  .pb-boton .pb-cuerpo { animation: pbFlota 3.2s ease-in-out infinite; transform-origin: 60px 70px; }
  .pb-ojos { animation: pbParpadea 4.5s infinite; transform-origin: 60px 50px; }
  .pb-antena { animation: pbLuz 2s ease-in-out infinite; }
  .pb-escribiendo i { animation: pbPunto 1s infinite; } .pb-escribiendo i:nth-child(2) { animation-delay: .15s; } .pb-escribiendo i:nth-child(3) { animation-delay: .3s; }
  .pb-panel { animation: pbAbre .18s ease-out; transform-origin: bottom right; }
}
@keyframes pbFlota { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes pbParpadea { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(.1) } }
@keyframes pbLuz { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes pbPunto { 0%,100% { opacity: .3 } 50% { opacity: 1 } }
.pb-bot .pb-texto { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; line-height: 1.45; max-height: 220px; overflow: auto; white-space: normal; user-select: text; }
.pb-bot .pb-login { display: grid; gap: 6px; margin-top: 6px; }
.pb-bot .pb-login input { background: #111114; color: inherit; border: 1px solid rgba(255,255,255,.18); border-radius: 8px; padding: 8px 10px; font: inherit; }
@keyframes pbAbre { from { opacity: 0; transform: scale(.94) } to { opacity: 1; transform: none } }
@media (max-width: 520px) { .pb-panel { right: 8px; left: 8px; width: auto; height: min(640px, calc(100vh - 120px)); } }
`;

const SUG = CLI ? ["¿Cómo puedo pagar?", "¿Manejan pago contra entrega?", "¿Hacen envíos a todo el país?", "¿Los juegos son físicos y nuevos?", "¿Tienen tienda física?", "Juegos de PS5", "Hablar con un asesor"]
  : ["Descripción de Mario Kart 8 Deluxe", "Factura de Éxito", "mario kart switch envío Pasto con Addi", "Addi 180000", "mercado libre 110000", "¿Qué garantía tienen las consolas?"];
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const estilo = document.createElement("style"); estilo.textContent = css; document.head.append(estilo);
const boton = document.createElement("button");
boton.type = "button"; boton.className = "pb-boton"; boton.setAttribute("aria-label", "Abrir Pipe Bot"); boton.innerHTML = ROBOT;
const globo = document.createElement("div"); globo.className = "pb-globo"; globo.textContent = CLI ? "¡Hola! Soy Pipe Bot. ¿Te ayudo a encontrar tu juego?" : "¡Hola! Soy Pipe Bot. ¿Qué buscas?";
const panel = document.createElement("section");
panel.className = "pb-panel"; panel.hidden = true; panel.setAttribute("aria-label", "Pipe Bot");
panel.innerHTML = `<div class="pb-cab"><div class="pb-mini">${ROBOT}</div><div class="pb-esp"><img src="${BASE}../inicio/titulos/pipebot.png" alt="Pipe Bot"><small id="pbEstado">Cargando catálogo…</small></div><button type="button" class="pb-cerrar" aria-label="Cerrar">×</button></div>
  <div class="pb-chat" aria-live="polite"></div>
  <form class="pb-form" autocomplete="off"><textarea rows="1" placeholder="Juego, precio, envío, Addi…" enterkeyhint="send" aria-label="Pregunta para Pipe Bot"></textarea><button type="submit">Enviar</button></form>`;
if (CLI) [boton, globo, panel].forEach(el => el.classList.add("pb-cliente"));
document.body.append(globo, boton, panel);
const chat = panel.querySelector(".pb-chat"), input = panel.querySelector(".pb-form textarea");
// Enter envía; Shift+Enter hace salto de línea (al pegar datos del cliente se conservan las líneas)
const crecer = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight + 2, 140) + "px"; };
input.addEventListener("input", crecer);
input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); panel.querySelector(".pb-form").requestSubmit(); } });
let listo = false;

function poner(html, quien) { const d = document.createElement("div"); d.className = "pb-msg pb-" + quien; d.innerHTML = html; chat.append(d); chat.scrollTop = chat.scrollHeight; return d; }
async function abrir() {
  globo.hidden = true; panel.hidden = false; boton.setAttribute("aria-label", "Cerrar Pipe Bot");
  try { sessionStorage.setItem("pb_visto", "1"); } catch {}
  if (!listo) {
    listo = true;
    poner(CLI ? `<h3>¡Hola! Soy Pipe Bot 🎮</h3><p>El asistente virtual de Pipe Games. Pregúntame por un juego, su precio y disponibilidad, el envío a tu ciudad o cómo pagar a cuotas con Addi o Sistecrédito.</p><div class="pb-sug">${SUG.map(s => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>`
      : `<h3>¡Hola, Felipe! 🎮</h3><p>Pregúntame por un juego (precio, stock, garantía y cuotas), el envío a cualquier municipio, el total con Addi o Sistecrédito o cuánto publicar en Mercado Libre, Falabella o Éxito. También redacto <b>descripciones</b> para las plataformas e Instagram y hago la <b>factura de Éxito</b> con los datos del cliente.</p><div class="pb-sug">${SUG.map(s => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>`, "bot");
    if (!CLI) acciones().catch(() => {});
    try { await cargar(); panel.querySelector("#pbEstado").textContent = CLI ? "Asistente virtual · catálogo al día" : `${disponibles()} productos disponibles · stock al día`; }
    catch { panel.querySelector("#pbEstado").textContent = "No pude cargar el stock; uso el catálogo guardado"; }
  }
  setTimeout(() => input.focus(), 50);
}
function cerrar() { panel.hidden = true; boton.setAttribute("aria-label", "Abrir Pipe Bot"); boton.focus(); }
async function preguntar(q) {
  q = q.trim(); if (!q) return;
  if (CLI && compra.paso) { poner(esc(q), "yo"); return responderPaso(q); }
  poner(esc(q).replace(/\n/g, "<br>"), "yo");
  try { if (desactualizado()) await cargar(); } catch {}
  if (!CLI) {
    let m = null; try { m = await acciones(); } catch {}
    if (m && m.manejar(q, poner)) return;
    const html = responder(q);
    if (m && m.respaldo(q, html, poner)) return;
    return poner(html, "bot");
  }
  const pensando = poner(`<span class="pb-escribiendo"><i></i><i></i><i></i></span>`, "bot");
  setTimeout(() => { pensando.innerHTML = responder(q, { modo: "cliente" }); chat.scrollTop = chat.scrollHeight; }, 350);
}
// Elegir un producto de una lista: muestra su ficha completa (con "Pedir este producto" en el catálogo)
function elegir(dato) {
  const [n, p] = dato.split("|");
  poner(esc(n + " · " + p), "yo");
  poner(verProducto(n, p, { modo: CLI ? "cliente" : "" }), "bot");
}
chat.addEventListener("keydown", e => { const v = e.target.closest("[data-ver]"); if (v && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); elegir(v.dataset.ver); } });
boton.addEventListener("click", () => panel.hidden ? abrir() : cerrar());
panel.querySelector(".pb-cerrar").addEventListener("click", cerrar);
panel.querySelector("form").addEventListener("submit", e => {
  e.preventDefault(); const q = input.value; input.value = ""; crecer();
  if (CLI && !compra.paso && /^\s*(continuar|comprar|finalizar|pagar)( (la )?compra)?\s*$/i.test(q)) { poner(esc(q), "yo"); return accion("continuar"); }
  preguntar(q);
});
chat.addEventListener("click", e => {
  const b = e.target.closest("[data-s]"); if (b) return preguntar(b.dataset.s);
  const v = e.target.closest("[data-ver]"); if (v) return elegir(v.dataset.ver);
  // Compra guiada (solo en el catálogo)
  const pd = e.target.closest("[data-pedir]"); if (pd) return agregar(pd.dataset.pedir);
  const ac = e.target.closest("[data-accion]"); if (ac && CLI) return accion(ac.dataset.accion, ac);
  const sc = e.target.closest("[data-seccion]"); if (sc && typeof window.pbIrSeccion === "function") { cerrar(); window.pbIrSeccion(sc.dataset.seccion); }
});

/* ══ Compra guiada: producto → ¿otro o continuar? → ciudad → pago → datos → WhatsApp ══ */
const compra = { paso: null, d: {} };
const fila = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
const botones = l => `<div class="pb-sug">${l.map(([a, t, extra]) => `<button type="button" data-accion="${a}"${extra || ""}>${t}</button>`).join("")}</div>`;
const esCredito = m => m === "addi" || m === "siste";
function resumenHtml(r) {
  return `<table>${r.items.map(i => fila(`${esc(i.n)} · ${esc(i.p)}${i.q > 1 ? " x" + i.q : ""}`, cop(i.q * i.v))).join("")}${fila("<b>Subtotal</b>", `<b>${cop(r.subtotal)}</b>`)}</table>`;
}
function agregar(dato) {
  if (typeof window.pbAgregar !== "function") return;
  const [n, p] = dato.split("|"), r = window.pbAgregar(n, p);
  if (!r) return poner(`<p>No pude agregar ese producto. Escríbenos por WhatsApp.</p>`, "bot");
  compra.paso = null;
  poner(esc("Agregar " + n), "yo");
  poner(`<h3>✅ Agregado a tu pedido</h3>${resumenHtml(r)}<p>¿Quieres agregar otro juego o seguimos con la compra?</p>${botones([["otro", "➕ Agregar otro"], ["continuar", "Continuar con la compra →"]])}`, "bot");
}
function preguntarPaso(paso, html) { compra.paso = paso; poner(html + botones([["cancelar", "Cancelar"]]), "bot"); input.focus(); }
function pedirPago() {
  const r = window.pbResumen(), base = r.subtotal + (compra.d.envio || 0);
  compra.paso = "pago";
  const ops = METODOS.map(m => {
    const no = m.credito && base >= TOPE_CUOTAS;
    const total = compra.d.porConfirmar ? m.calc(r.subtotal) : m.calc(base);
    return [`pago:${m.id}`, `${esc(m.t.split(" · ")[0])} · ${no ? "no aplica" : cop(total)}`, no ? " disabled" : ""];
  });
  poner(`<h3>¿Cómo quieres pagar?</h3><p class="nota">${compra.d.porConfirmar ? "Valores sin el envío, que te confirmamos por WhatsApp." : "Total con el envío incluido."} Addi y Sistecrédito son a cuotas${base >= TOPE_CUOTAS ? " y no aplican desde $1.000.000" : ""}.</p>${botones([...ops, ["cancelar", "Cancelar"]])}`, "bot");
}
function resumenFinal() {
  const r = window.pbResumen(), d = compra.d, m = METODOS.find(x => x.id === d.metodo);
  const base = r.subtotal + (d.envio || 0), total = m.calc(base);
  compra.paso = "confirmar";
  const local = d.local && esCredito(d.metodo);
  poner(`<h3>Revisa tu pedido</h3>${resumenHtml(r)}<table>${fila("Envío", d.porConfirmar ? "Te lo confirmamos" : cop(d.envio))}${total !== base ? fila("Recargo " + esc(m.t.split(" · ")[0]), cop(total - base)) : ""}${fila("<b>Total</b>", `<b>${cop(total)}</b>${d.porConfirmar ? " + envío" : ""}`)}</table>
    <p class="nota">${esc(d.nombre)} · ${esc(d.ciudad)} · ${esc(m.t.split(" · ")[0])}</p>
    ${local ? `<p>Último paso: marca tu casa en el mapa para que el domicilio llegue exacto.</p>${botones([["mapa", "📍 Marcar mi casa y enviar"], ["cancelar", "Cancelar"]])}`
      : `${botones([["enviar", "Enviar pedido por WhatsApp ✓"], ["cancelar", "Cancelar"]])}<p class="nota">Se abrirá WhatsApp con tu pedido listo; solo toca enviar.</p>`}`, "bot");
}
function siguienteDato() {
  const d = compra.d;
  if (!esCredito(d.metodo)) return resumenFinal();
  if (!d.cedula) return preguntarPaso("cedula", `<p>Para tramitar tu crédito necesito tu <b>número de cédula</b>.</p>`);
  if (!d.correo) return preguntarPaso("correo", `<p>¿Cuál es tu <b>correo electrónico</b>?</p>`);
  if (!d.tel) return preguntarPaso("tel", `<p>¿Tu <b>celular</b>? (10 dígitos)</p>`);
  if (!d.dir) return preguntarPaso("dir", `<p>¿Cuál es la <b>dirección</b> de entrega? Incluye apto, torre o casa si aplica.</p>`);
  if (!d.barrio) return preguntarPaso("barrio", `<p>¿En qué <b>barrio</b>?</p>`);
  resumenFinal();
}
function responderPaso(q) {
  const d = compra.d, paso = compra.paso;
  if (paso === "ciudad") {
    const c = ciudadCliente(q);
    if (!c) return preguntarPaso("ciudad", `<p>No encontré “${esc(q)}”. Escribe tu ciudad o municipio, por ejemplo <i>Medellín</i> o <i>Soacha</i>.</p>`);
    if (c.multi) { compra.paso = "ciudad"; return poner(`<p>Hay varios con ese nombre. ¿Cuál es?</p>${botones(c.multi.map(e => ["ciudad:" + e, esc(e)]))}`, "bot"); }
    return fijarCiudad(c.etiqueta);
  }
  if (paso === "nombre") { if (q.length < 3) return preguntarPaso("nombre", `<p>Escribe tu nombre y apellido.</p>`); d.nombre = q; return siguienteDato(); }
  if (paso === "cedula") { const v = q.replace(/\D/g, ""); if (v.length < 5 || v.length > 12) return preguntarPaso("cedula", `<p>Escribe solo los números de tu cédula.</p>`); d.cedula = v; return siguienteDato(); }
  if (paso === "correo") { if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(q)) return preguntarPaso("correo", `<p>Ese correo no parece válido. Escríbelo de nuevo.</p>`); d.correo = q.toLowerCase(); return siguienteDato(); }
  if (paso === "tel") { const v = q.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, ""); if (!/^3\d{9}$/.test(v)) return preguntarPaso("tel", `<p>Escribe un celular de 10 dígitos que empiece por 3.</p>`); d.tel = v; return siguienteDato(); }
  if (paso === "dir") { if (q.length < 6) return preguntarPaso("dir", `<p>Escribe la dirección completa.</p>`); d.dir = q; return siguienteDato(); }
  if (paso === "barrio") { if (q.length < 2) return preguntarPaso("barrio", `<p>Escribe el barrio.</p>`); d.barrio = q; return siguienteDato(); }
  // En los pasos con botones, lo escrito se toma como una pregunta normal y la compra queda en pausa
  compra.paso = null;
  poner(responder(q, { modo: "cliente" }), "bot");
}
function fijarCiudad(etiqueta) {
  const r = window.pbResumen(), e = envioCliente(etiqueta, r.items.map(i => i.n));
  Object.assign(compra.d, { ciudad: etiqueta, envio: e.valor, porConfirmar: !!e.porConfirmar, local: /^(bogota|chia|soacha)/i.test(etiqueta.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) });
  poner(`<p>🚚 ${esc(e.texto)}.</p>`, "bot");
  pedirPago();
}
function accion(a, btn) {
  if (a === "otro") { compra.paso = null; poner(`<p>¡Dale! Escribe el nombre del otro juego que quieres.</p>`, "bot"); return input.focus(); }
  if (a === "cancelar") { compra.paso = null; compra.d = {}; return poner(`<p>Listo, dejé la compra en pausa. Tu pedido sigue en el carrito 🛒. Cuando quieras, escribe <b>continuar</b>.</p>`, "bot"); }
  if (a === "continuar") {
    const r = window.pbResumen();
    if (!r.items.length) return poner(`<p>Tu pedido está vacío. Escribe el nombre de un juego para empezar.</p>`, "bot");
    compra.d = {}; if (btn) poner(esc("Continuar con la compra"), "yo");
    return preguntarPaso("ciudad", `<h3>¡Vamos! 🎮</h3>${resumenHtml(r)}<p>¿A qué <b>ciudad o municipio</b> enviamos tu pedido?</p>`);
  }
  if (a.startsWith("ciudad:")) { poner(esc(a.slice(7)), "yo"); return fijarCiudad(a.slice(7)); }
  if (a.startsWith("pago:")) {
    if (compra.paso !== "pago") return;
    compra.d.metodo = a.slice(5); poner(esc(btn.textContent), "yo");
    return preguntarPaso("nombre", `<p>¿A nombre de quién va el pedido? Escribe tu <b>nombre y apellido</b>.</p>`);
  }
  if (a === "enviar" && compra.paso === "confirmar") {
    const d = compra.d; window.pbEnviar({ ...d, comp: "" });
    compra.paso = null; compra.d = {};
    return poner(`<h3>¡Listo! 🙌</h3><p>Te abrí WhatsApp con tu pedido. Solo toca <b>enviar</b> y te respondemos para confirmar el pago y el envío.</p><p class="nota">Si no se abrió, escríbenos al 311 883 6995.</p>`, "bot");
  }
  if (a === "mapa" && compra.paso === "confirmar") {
    const d = compra.d; compra.paso = null; compra.d = {};
    cerrar(); window.pbAbrirCompra({ ...d, comp: "" });
  }
}

document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) cerrar(); });
// El saludo del globo sale una vez por visita y se va solo
let visto = false; try { visto = sessionStorage.getItem("pb_visto") === "1"; } catch {}
if (visto) globo.hidden = true; else setTimeout(() => { globo.hidden = true; }, 7000);
globo.addEventListener("click", abrir);
