// Agente de Instagram de Pipe Games (Cloudflare Worker).
// Recibe los mensajes directos de @pipe_games_ (webhook de Meta), consulta el catálogo con el
// stock en vivo (catalogo-meta.csv) y responde con Claude siguiendo las reglas de la tienda.
//
// Variables del Worker (Cloudflare → tu Worker → Settings → Variables and Secrets):
//   IG_TOKEN           (Secret)  Token de acceso de Instagram (API setup with Instagram login → Generate token)
//   IG_APP_SECRET      (Secret)  Instagram app secret (misma pantalla de la app de Meta)
//   VERIFY_TOKEN       (Secret)  Una palabra que tú inventas; se repite al configurar el webhook en Meta
//   ANTHROPIC_API_KEY  (Secret)  Clave de la API de Claude (console.anthropic.com)
//   ANTHROPIC_MODEL    (Text, opcional) claude-sonnet-5-5
//   AGENTE_ACTIVO      (Text, opcional) "no" apaga las respuestas automáticas sin borrar nada
//   HORAS_PAUSA        (Text, opcional) horas que el agente se calla en un chat después de que respondes tú (por defecto 12)
// Enlace de almacenamiento (Settings → Bindings → KV namespace):
//   AGENTE             KV namespace para el historial de cada chat y las pausas
// Disparador programado (Settings → Triggers → Cron): 0 9 * * 1   (renueva el token cada lunes)

const GRAPH = "https://graph.instagram.com/v24.0";
const CATALOGO_CSV = "https://pipegames.com.co/catalogo-meta.csv";
const MAX_TURNOS = 16;          // mensajes que recuerda por chat
const MAX_DIARIOS = 40;         // respuestas máximas por cliente al día (control de gasto)

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // Verificación del webhook (Meta llama una vez al configurarlo)
    if (req.method === "GET" && url.pathname === "/webhook") {
      const ok = url.searchParams.get("hub.mode") === "subscribe" && env.VERIFY_TOKEN &&
        url.searchParams.get("hub.verify_token") === env.VERIFY_TOKEN;
      return ok ? new Response(url.searchParams.get("hub.challenge") || "") : new Response("No autorizado", { status: 403 });
    }
    if (req.method === "GET" && url.pathname === "/salud") {
      return Response.json({
        ok: true, activo: env.AGENTE_ACTIVO !== "no", token: !!(env.IG_TOKEN || (env.AGENTE && await env.AGENTE.get("token"))),
        secreto: !!env.IG_APP_SECRET, verify: !!env.VERIFY_TOKEN, claude: !!env.ANTHROPIC_API_KEY, kv: !!env.AGENTE
      });
    }
    if (req.method !== "POST" || url.pathname !== "/webhook") return new Response("Pipe Games", { status: 404 });

    const cuerpo = await req.text();
    if (!(await firmaValida(cuerpo, req.headers.get("x-hub-signature-256"), env.IG_APP_SECRET))) {
      return new Response("Firma no válida", { status: 401 });
    }
    let datos; try { datos = JSON.parse(cuerpo); } catch { return new Response("ok"); }
    // Se responde 200 de inmediato y el trabajo sigue en segundo plano (Meta reintenta si tardamos)
    ctx.waitUntil(procesar(datos, env).catch(e => console.log("error", e && e.stack || e)));
    return new Response("ok");
  },

  // Renueva el token de Instagram (dura 60 días) y lo guarda en el KV
  async scheduled(evento, env) {
    const actual = (env.AGENTE && await env.AGENTE.get("token")) || env.IG_TOKEN;
    if (!actual) return;
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(actual)}`);
    const j = await r.json().catch(() => ({}));
    if (j.access_token && env.AGENTE) await env.AGENTE.put("token", j.access_token);
    console.log("renovar token", r.status, j.expires_in || j.error && j.error.message);
  }
};

async function procesar(datos, env) {
  if (!env.AGENTE) { console.log("Falta el KV AGENTE"); return; }
  for (const entrada of datos.entry || []) {
    const cuenta = String(entrada.id || "");
    for (const ev of entrada.messaging || []) {
      const m = ev.message;
      if (!m || !m.mid) continue;
      if (await env.AGENTE.get("visto:" + m.mid)) continue;                 // reintento de Meta
      await env.AGENTE.put("visto:" + m.mid, "1", { expirationTtl: 86400 });

      // Mensaje que sale de la cuenta de Pipe Games
      if (m.is_echo || String(ev.sender && ev.sender.id) === cuenta) {
        const cliente = String(ev.recipient && ev.recipient.id || "");
        const delAgente = await env.AGENTE.get("mio:" + m.mid) || await env.AGENTE.get("enviando:" + cliente);
        if (!delAgente && cliente) {
          // Respondiste tú desde Instagram: el agente se calla en ese chat por unas horas
          const horas = Number(env.HORAS_PAUSA) || 12;
          await env.AGENTE.put("pausa:" + cliente, "tu", { expirationTtl: Math.max(60, horas * 3600) });
          if (m.text) await guardarTurno(env, cliente, "assistant", "[Felipe respondió] " + m.text);
        }
        continue;
      }

      const cliente = String(ev.sender && ev.sender.id || "");
      if (!cliente) continue;
      const texto = (m.text || "").trim();
      if (!texto) {
        // Fotos, audios, historias: se guardan como contexto y los atiende Felipe
        await guardarTurno(env, cliente, "user", "[El cliente envió " + ((m.attachments && m.attachments[0] && m.attachments[0].type) || "un adjunto") + "]");
        continue;
      }
      await guardarTurno(env, cliente, "user", texto);
      if (env.AGENTE_ACTIVO === "no") continue;
      if (await env.AGENTE.get("pausa:" + cliente)) continue;

      const dia = "dia:" + cliente + ":" + new Date().toISOString().slice(0, 10);
      const usados = Number(await env.AGENTE.get(dia)) || 0;
      if (usados >= MAX_DIARIOS) continue;
      await env.AGENTE.put(dia, String(usados + 1), { expirationTtl: 172800 });

      const historial = await leerHistorial(env, cliente);
      let respuesta = await preguntarClaude(env, historial);
      if (!respuesta) continue;
      let pasarAFelipe = false;
      if (respuesta.includes("[HUMANO]")) { pasarAFelipe = true; respuesta = respuesta.replace(/\[HUMANO\]/g, "").trim(); }
      if (respuesta) {
        await enviar(env, cliente, respuesta);
        await guardarTurno(env, cliente, "assistant", respuesta);
      }
      if (pasarAFelipe) await env.AGENTE.put("pausa:" + cliente, "humano", { expirationTtl: 12 * 3600 });
    }
  }
}

/* ---------- historial por chat (24 h, igual que la ventana de Instagram) ---------- */
async function leerHistorial(env, cliente) {
  try { return JSON.parse(await env.AGENTE.get("hist:" + cliente) || "[]"); } catch { return []; }
}
async function guardarTurno(env, cliente, rol, texto) {
  const h = await leerHistorial(env, cliente);
  const ult = h[h.length - 1];
  if (ult && ult.role === rol) ult.content += "\n" + texto; else h.push({ role: rol, content: texto });
  await env.AGENTE.put("hist:" + cliente, JSON.stringify(h.slice(-MAX_TURNOS)), { expirationTtl: 86400 });
}

/* ---------- catálogo con stock en vivo ---------- */
async function catalogo() {
  const cache = caches.default, clave = new Request(CATALOGO_CSV + "?agente");
  let r = await cache.match(clave);
  if (!r) {
    const f = await fetch(CATALOGO_CSV, { cf: { cacheTtl: 300 } });
    if (!f.ok) return null;
    r = new Response(await f.text(), { headers: { "Cache-Control": "max-age=300" } });
    await cache.put(clave, r.clone());
  }
  const filas = leerCsv(await r.text());
  const cab = filas.shift() || [];
  const i = n => cab.indexOf(n);
  const lineas = [], enlaces = {};
  for (const f of filas) {
    if (f[i("availability")] !== "in stock") continue;
    const precio = Number(String(f[i("price")] || "").replace(/[^\d]/g, "")) || 0;
    lineas.push(`${f[i("id")]} | ${f[i("title")]} | $${precio.toLocaleString("es-CO")}`);
    enlaces[f[i("id")]] = f[i("link")];
  }
  return { lista: lineas.join("\n"), enlaces };
}
function leerCsv(t) {
  const filas = []; let fila = [], campo = "", comillas = false;
  for (let k = 0; k < t.length; k++) {
    const c = t[k];
    if (comillas) {
      if (c === '"' && t[k + 1] === '"') { campo += '"'; k++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[k + 1] === "\n") k++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

/* ---------- Claude ---------- */
function instrucciones(lista) {
  const ahora = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  return `Eres el asistente de Pipe Games en los mensajes directos de Instagram (@pipe_games_). Pipe Games es una tienda virtual de videojuegos en Bogotá, Colombia: juegos físicos nuevos y sellados de PS4, PS5, Nintendo Switch y Switch 2, consolas y accesorios. Hoy es ${ahora} (hora de Bogotá).

CÓMO ESCRIBES
- Español neutro de Colombia, cálido y directo; tutea. Nada de voseo argentino.
- Mensajes cortos, como en un chat: 1 a 4 frases. Un emoji de vez en cuando está bien, sin exagerar.
- Nunca inventes productos, precios, fechas ni promociones. Solo puedes ofrecer lo que está en la LISTA DISPONIBLE.
- Si el cliente pregunta por algo que no está en la lista, dile que en este momento no está disponible y ofrece una alternativa parecida de la lista si la hay, o que escriba al WhatsApp para consultar si llega pronto.
- Si el cliente no dice la consola y el juego existe en varias, pregúntale para cuál la quiere.
- Cuando el cliente quiera comprar un producto, escribe [PEDIDO:ID] con el ID del producto de la lista (por ejemplo [PEDIDO:MINECRAFT-PS5]); el sistema lo cambia por un enlace que abre el catálogo con ese producto en el carrito, donde escoge envío y forma de pago. También puede pedir por WhatsApp. No escribas enlaces de pedido tú mismo.

DATOS DE LA TIENDA
- WhatsApp: 311 883 6995 (única línea oficial). Catálogo: pipegames.com.co
- Entregas: Bogotá, Chía y Soacha el mismo día si compra antes de las 3:00 p. m., domicilio de $10.000. Resto del país: 1 a 3 días hábiles por transportadora; el valor del envío depende de la ciudad y se calcula en el carrito del catálogo (o te lo confirma Felipe).
- Pagos: transferencia por llave Bre-B (sin recargo); tarjeta de crédito con link de Bold (+3,59% + $900); Addi (+7,7%) y Sistecrédito (+5%). Para compras desde $1.000.000 (por ejemplo consolas) solo transferencia o tarjeta, no Addi ni Sistecrédito.
- No hay tienda física para visitar: es 100% virtual.

CUÁNDO PASAR A FELIPE (el dueño)
Escribe al final de tu mensaje la marca [HUMANO] (el cliente no la ve) cuando:
- El cliente ya decidió comprar y quiere pagar, separar o confirmar un pedido por aquí, o pagar con Addi o Sistecrédito (piden cédula y correo; eso lo gestiona Felipe).
- Pregunta por un pedido ya hecho, una garantía, un reclamo, una devolución o el estado de un envío.
- Pide descuentos, precios por cantidad, compra de juegos usados o algo que no puedes resolver con estos datos.
- Está molesto o insiste en hablar con una persona.
En esos casos dile que Felipe le responde personalmente en breve por este chat (o que puede escribir al WhatsApp para ir más rápido).
- Si el mensaje es un saludo, una reacción o un comentario sin pregunta, responde breve y pregunta en qué le puedes ayudar.
- Si el texto empieza con "[Felipe respondió]", es un mensaje que escribió Felipe: tenlo en cuenta y no lo contradigas.

LISTA DISPONIBLE (ID | nombre - consola | precio). Todo lo de esta lista está en stock ahora:
${lista || "(no se pudo cargar la lista: no confirmes disponibilidad ni precios; pide al cliente escribir al WhatsApp)"}`;
}

async function preguntarClaude(env, historial) {
  if (!env.ANTHROPIC_API_KEY) { console.log("Falta ANTHROPIC_API_KEY"); return ""; }
  const mensajes = historial.slice();
  while (mensajes.length && mensajes[0].role !== "user") mensajes.shift();
  if (!mensajes.length || mensajes[mensajes.length - 1].role !== "user") return "";
  const cat = await catalogo() || { lista: "", enlaces: {} };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 600,
      system: [{ type: "text", text: instrucciones(cat.lista), cache_control: { type: "ephemeral" } }],
      messages: mensajes
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log("Claude", r.status, JSON.stringify(j).slice(0, 300)); return ""; }
  const texto = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
  return texto.replace(/\[PEDIDO:([A-Z0-9-]+)\]/g, (t, id) => cat.enlaces[id] || "pipegames.com.co");
}

/* ---------- Instagram ---------- */
async function enviar(env, cliente, texto) {
  const token = (await env.AGENTE.get("token")) || env.IG_TOKEN;
  if (!token) { console.log("Falta IG_TOKEN"); return; }
  await env.AGENTE.put("enviando:" + cliente, "1", { expirationTtl: 60 });
  for (const parte of partir(texto, 950)) {
    const r = await fetch(GRAPH + "/me/messages", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: cliente }, message: { text: parte } })
    });
    const j = await r.json().catch(() => ({}));
    if (j.message_id) await env.AGENTE.put("mio:" + j.message_id, "1", { expirationTtl: 3600 });
    else console.log("Instagram", r.status, JSON.stringify(j).slice(0, 300));
  }
}
// Instagram acepta hasta 1000 bytes por mensaje
function partir(texto, max) {
  const enc = new TextEncoder(), partes = [];
  let actual = "";
  for (const linea of texto.split(/(?<=\n)|(?<=[.!?] )/)) {
    if (enc.encode(actual + linea).length > max && actual) { partes.push(actual.trim()); actual = ""; }
    actual += linea;
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
}

/* ---------- firma de Meta ---------- */
async function firmaValida(cuerpo, cabecera, secreto) {
  if (!secreto || !cabecera || !cabecera.startsWith("sha256=")) return false;
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(cuerpo)));
  const hex = [...firma].map(b => b.toString(16).padStart(2, "0")).join("");
  const esperado = cabecera.slice(7);
  if (hex.length !== esperado.length) return false;
  let dif = 0; for (let k = 0; k < hex.length; k++) dif |= hex.charCodeAt(k) ^ esperado.charCodeAt(k);
  return dif === 0;
}
