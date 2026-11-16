// Pipe Bot: asistente flotante (abajo a la derecha). Se carga con <script type="module" src="../asistente/widget.js"></script>
// Usa el motor de asistente/motor.js: catálogo con stock en vivo, tarifas de envío y fórmulas de pago y plataformas.
import { cargar, responder, desactualizado, disponibles } from "./motor.js";

const BASE = new URL(".", import.meta.url).href; // carpeta asistente/
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
.pb-bot .pr { font: 400 15px 'Russo One', sans-serif; text-align: right; }
.pb-bot .sub { color: #9a9aa2; font-size: 12.5px; grid-column: 1 / -1; }
.pb-bot .chip { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; border-radius: 999px; padding: 1px 7px; margin-left: 6px; vertical-align: 1px; }
.pb-bot .chip.ok { background: rgba(62,207,142,.15); color: #3ecf8e; } .pb-bot .chip.no { background: rgba(255,123,123,.14); color: #ff7b7b; }
.pb-bot table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.pb-bot td { padding: 3px 0; border-top: 1px solid rgba(255,255,255,.09); }
.pb-bot td:last-child { text-align: right; white-space: nowrap; padding-left: 10px; font-variant-numeric: tabular-nums; }
.pb-sug { display: flex; flex-wrap: wrap; gap: 6px; }
.pb-sug button { font: 500 12.5px/1.2 'Barlow', Arial, sans-serif; color: #f4f4f5; background: #0c0c0e; border: 1px solid rgba(255,255,255,.22); border-radius: 999px; padding: 6px 10px; cursor: pointer; }
.pb-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid rgba(255,255,255,.1); background: #0d0d0f; }
.pb-form input { flex: 1; min-width: 0; font: 16px 'Barlow', Arial, sans-serif; color: #f4f4f5; background: #202024; border: 1px solid rgba(255,255,255,.22); border-radius: 12px; padding: 10px 12px; }
.pb-form button { font: 400 14px 'Russo One', sans-serif; background: #d6d6da; color: #0a0a0c; border: 0; border-radius: 12px; padding: 0 14px; cursor: pointer; }
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
@keyframes pbAbre { from { opacity: 0; transform: scale(.94) } to { opacity: 1; transform: none } }
@media (max-width: 520px) { .pb-panel { right: 8px; left: 8px; width: auto; height: min(640px, calc(100vh - 120px)); } }
`;

const SUG = ["mario kart switch", "envío a Medellín", "mario kart switch envío Pasto con Addi", "Addi 180000", "mercado libre 110000", "horario"];
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const estilo = document.createElement("style"); estilo.textContent = css; document.head.append(estilo);
const boton = document.createElement("button");
boton.type = "button"; boton.className = "pb-boton"; boton.setAttribute("aria-label", "Abrir Pipe Bot"); boton.innerHTML = ROBOT;
const globo = document.createElement("div"); globo.className = "pb-globo"; globo.textContent = "¡Hola! Soy Pipe Bot. ¿Qué buscas?";
const panel = document.createElement("section");
panel.className = "pb-panel"; panel.hidden = true; panel.setAttribute("aria-label", "Pipe Bot");
panel.innerHTML = `<div class="pb-cab"><div class="pb-mini">${ROBOT}</div><div class="pb-esp"><img src="${BASE}../inicio/titulos/pipebot.png" alt="Pipe Bot"><small id="pbEstado">Cargando catálogo…</small></div><button type="button" class="pb-cerrar" aria-label="Cerrar">×</button></div>
  <div class="pb-chat" aria-live="polite"></div>
  <form class="pb-form" autocomplete="off"><input placeholder="Juego, precio, envío, Addi…" enterkeyhint="send" aria-label="Pregunta para Pipe Bot"><button type="submit">Enviar</button></form>`;
document.body.append(globo, boton, panel);
const chat = panel.querySelector(".pb-chat"), input = panel.querySelector("input");
let listo = false;

function poner(html, quien) { const d = document.createElement("div"); d.className = "pb-msg pb-" + quien; d.innerHTML = html; chat.append(d); chat.scrollTop = chat.scrollHeight; return d; }
async function abrir() {
  globo.hidden = true; panel.hidden = false; boton.setAttribute("aria-label", "Cerrar Pipe Bot");
  try { sessionStorage.setItem("pb_visto", "1"); } catch {}
  if (!listo) {
    listo = true;
    poner(`<h3>¡Hola, Felipe! 🎮</h3><p>Pregúntame por un juego (precio, stock y cuotas), el envío a cualquier municipio, el total con Addi o Sistecrédito, o cuánto publicar en Mercado Libre, Falabella o Éxito.</p><div class="pb-sug">${SUG.map(s => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>`, "bot");
    try { await cargar(); panel.querySelector("#pbEstado").textContent = `${disponibles()} productos disponibles · stock al día`; }
    catch { panel.querySelector("#pbEstado").textContent = "No pude cargar el stock; uso el catálogo guardado"; }
  }
  setTimeout(() => input.focus(), 50);
}
function cerrar() { panel.hidden = true; boton.setAttribute("aria-label", "Abrir Pipe Bot"); boton.focus(); }
async function preguntar(q) {
  q = q.trim(); if (!q) return;
  poner(esc(q), "yo");
  const pensando = poner(`<span class="pb-escribiendo"><i></i><i></i><i></i></span>`, "bot");
  try { if (desactualizado()) await cargar(); } catch {}
  setTimeout(() => { pensando.innerHTML = responder(q); chat.scrollTop = chat.scrollHeight; }, 350);
}
boton.addEventListener("click", () => panel.hidden ? abrir() : cerrar());
panel.querySelector(".pb-cerrar").addEventListener("click", cerrar);
panel.querySelector("form").addEventListener("submit", e => { e.preventDefault(); const q = input.value; input.value = ""; preguntar(q); });
chat.addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) preguntar(b.dataset.s); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) cerrar(); });
// El saludo del globo sale una vez por visita y se va solo
let visto = false; try { visto = sessionStorage.getItem("pb_visto") === "1"; } catch {}
if (visto) globo.hidden = true; else setTimeout(() => { globo.hidden = true; }, 7000);
globo.addEventListener("click", abrir);
