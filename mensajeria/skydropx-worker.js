// Intermediario entre el panel de despacho y la API de Skydropx (Cloudflare Worker).
// Guarda en secreto las credenciales de Skydropx y solo atiende a la cuenta de despacho.
//
// Variables del Worker (Cloudflare → tu Worker → Settings → Variables and Secrets):
//   SKYDROPX_CLIENT_ID      (Secret)  Client ID de Skydropx
//   SKYDROPX_CLIENT_SECRET  (Secret)  Client Secret de Skydropx
//   SKYDROPX_BASE           (Text, opcional) https://pro.skydropx.com/api/v1  (pruebas: https://sb-pro.skydropx.com/api/v1)
//   FIREBASE_PROJECT        (Text)    mensajeria-prueba-b9198
//   ADMIN_UID               (Text)    8xMsK91tEja5hzhBtjqDIgCP0423
//   ORIGEN                  (Text, opcional) https://pipegames.com.co
//
// Addi (pago a cuotas), opcional:
//   ADDI_CLIENT_ID / ADDI_CLIENT_SECRET   (Secret)  credenciales de operación
//   ADDI_NOTI_USER / ADDI_NOTI_PASS       (Secret)  credenciales de notificación (Basic Auth del aviso de Addi)
//   ADDI_AMBIENTE                         (Text, opcional) "produccion" (por defecto) o "pruebas"
//   FIREBASE_SA                           (Secret)  JSON de la cuenta de servicio de Firebase (para marcar pagado)
//   ANTHROPIC_API_KEY       (Secret)  Clave de la API de Claude (console.anthropic.com) para el generador de publicaciones
//   ANTHROPIC_MODEL         (Text, opcional) claude-sonnet-5-5
//
// El panel le envía { metodo, ruta, cuerpo } y el Worker lo reenvía a Skydropx con su token.

const BASE_POR_DEFECTO = "https://pro.skydropx.com/api/v1";
const RUTAS_PERMITIDAS = /^\/(quotations|shipments|carriers|orders|labels|pickups|trackings?|addresses|packagings?|protect)(\/[A-Za-z0-9_-]+)*(\?[A-Za-z0-9_=&.%-]*)?$/;

let tokenSkydropx = { valor: "", vence: 0, base: "" };

export default {
  async fetch(req, env) {
    const origenCfg = (env.ORIGEN || "https://pipegames.com.co").replace(/\/+$/, "");
    const origenReq = req.headers.get("Origin") || "";
    const origenOk = o => !!o && (o === origenCfg || /^https:\/\/(www\.)?pipegames\.com\.co$/.test(o));
    const origen = origenOk(origenReq) ? origenReq : origenCfg;
    const cors = {
      "Access-Control-Allow-Origin": origen,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400"
    };
    const responder = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const base = (env.SKYDROPX_BASE || BASE_POR_DEFECTO).replace(/\/+$/, "");
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/salud") {
      return responder({ ok: true, base, credenciales: !!(env.SKYDROPX_CLIENT_ID && env.SKYDROPX_CLIENT_SECRET), firebase: !!env.FIREBASE_PROJECT, admin: !!env.ADMIN_UID,
        addi: !!(env.ADDI_CLIENT_ID && env.ADDI_CLIENT_SECRET), addiAvisos: !!(env.ADDI_NOTI_USER && env.ADDI_NOTI_PASS), cuentaServicio: !!env.FIREBASE_SA });
    }
    // Aviso de Addi con el resultado del crédito (no lleva token de Firebase: se valida con Basic Auth)
    if (req.method === "POST" && url.pathname === "/addi/aviso") return avisoAddi(req, env, url);
    // Link corto para el cliente: /addi/ir?c=<reserva>.<código> → página de Addi
    if (req.method === "GET" && url.pathname === "/addi/ir") return irAddi(env, url);
    // Prueba del cotizador desde el navegador: /cotizar?c=Girardot&d=Cundinamarca (muestra el detalle de Skydropx)
    if (req.method === "GET" && url.pathname === "/cotizar") return cotizarPublico({ ciudad: url.searchParams.get("c"), depto: url.searchParams.get("d"), detalle: true }, env, base, responder);
    if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);
    // Cotizador público (catálogo, link de saldo y datos de envío): solo cotiza, nunca crea guías
    if (url.pathname === "/cotizar") {
      if (!origenOk(origenReq)) return responder({ error: "Origen no permitido: " + origenReq }, 403);
      let b; try { b = await req.json(); } catch { return responder({ error: "Cuerpo inválido" }, 400); }
      return cotizarPublico(b, env, base, responder);
    }

    // 1) Solo la cuenta de despacho (token de Firebase verificado)
    try {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      await verificarFirebase(token, env);
    } catch (e) {
      return responder({ error: "No autorizado: " + (e.message || e) }, 401);
    }

    // 2) Reenviar a Skydropx
    let pedido;
    try { pedido = await req.json(); } catch { return responder({ error: "Cuerpo inválido" }, 400); }
    // Crear la solicitud de crédito en Addi (solo desde el panel, después de autorizar por WhatsApp)
    if (String(pedido.metodo || "").toUpperCase() === "ADDI_CREAR") {
      try { return responder(await crearAddi(pedido.pedido || {}, env, url)); }
      catch (e) { return responder({ error: "Addi: " + (e.message || e) }, 400); }
    }
    // Abrir un link corto de Google Maps (maps.app.goo.gl) para leer las coordenadas del punto
    if (String(pedido.metodo || "").toUpperCase() === "EXPANDIR") {
      try { return responder({ url: await expandirMaps(String(pedido.url || "")) }); }
      catch (e) { return responder({ error: "No se pudo abrir el link: " + (e.message || e) }, 400); }
    }
    // Redactar textos y leer fotos de etiquetas con IA (Publicaciones, Pipe Bot y el panel de despacho).
    // Usa Claude si hay ANTHROPIC_API_KEY; si no, la IA gratuita de Cloudflare (binding "AI", cupo diario gratis).
    if (String(pedido.metodo || "").toUpperCase() === "REDACTAR") {
      const texto = String(pedido.prompt || "").slice(0, 12000);
      if (!texto) return responder({ error: "Falta el texto" }, 400);
      // Fotos opcionales (etiquetas de Mercado Libre / Falabella): hasta 4 JPEG o PNG en base64, máx. ~1,5 MB cada una
      const fotos = (Array.isArray(pedido.imagenes) ? pedido.imagenes : []).slice(0, 4)
        .filter(f => f && /^image\/(jpeg|png|webp)$/.test(f.tipo) && typeof f.datos === "string" && f.datos.length < 2100000);
      if (env.ANTHROPIC_API_KEY) {
        const contenido = fotos.length ? [...fotos.map(f => ({ type: "image", source: { type: "base64", media_type: f.tipo, data: f.datos } })), { type: "text", text: texto }] : texto;
        try {
          const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({ model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 2000, messages: [{ role: "user", content: contenido }] })
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return responder({ error: "Claude respondió " + r.status + ": " + ((j.error && j.error.message) || "") }, 502);
          return responder({ texto: (j.content || []).filter(c => c.type === "text").map(c => c.text).join(""), ia: "claude" });
        } catch (e) {
          return responder({ error: "No se pudo hablar con Claude: " + (e.message || e) }, 502);
        }
      }
      if (!env.AI) return responder({ error: "Falta conectar la IA de Cloudflare al Worker (Settings → Bindings → Workers AI, nombre AI)" }, 500);
      try {
        return responder({ texto: await iaCloudflare(env, texto, fotos[0]), ia: "cloudflare" });
      } catch (e) {
        const m = String(e.message || e);
        return responder({ error: /neuron|quota|limit|429|capacity/i.test(m) ? "Se acabó el cupo gratis de IA de hoy; mañana se renueva" : "IA de Cloudflare: " + m }, 502);
      }
    }
    const metodo = String(pedido.metodo || "GET").toUpperCase();
    const ruta = String(pedido.ruta || "");
    if (!["GET", "POST", "PATCH"].includes(metodo)) return responder({ error: "Método no permitido" }, 400);
    if (!RUTAS_PERMITIDAS.test(ruta)) return responder({ error: "Ruta no permitida: " + ruta }, 400);
    if (!env.SKYDROPX_CLIENT_ID || !env.SKYDROPX_CLIENT_SECRET) return responder({ error: "Faltan las credenciales de Skydropx en el Worker" }, 500);

    try {
      let tk = await tokenDeSkydropx(env, base);
      let r = await llamar(base, ruta, metodo, pedido.cuerpo, tk);
      if (r.status === 401) { tokenSkydropx.vence = 0; tk = await tokenDeSkydropx(env, base); r = await llamar(base, ruta, metodo, pedido.cuerpo, tk); }
      const texto = await r.text();
      let datos; try { datos = JSON.parse(texto); } catch { datos = { texto }; }
      return responder({ estado: r.status, datos }, 200);
    } catch (e) {
      return responder({ error: "Error hablando con Skydropx: " + (e.message || e) }, 502);
    }
  }
};

/* ---------- Cotizador público: valor del envío a municipios sin tarifa fija ---------- */
// Remitente guardado en el panel (Conexión y datos del remitente). Se lee con la cuenta de servicio y se guarda 1 hora.
let remitenteCache = { t: 0, v: null };
async function origenesRemitente(env) {
  if (!remitenteCache.v || Date.now() - remitenteCache.t > 3600e3) {
    let rem = {}, variante = 0;
    try {
      if (env.FIREBASE_SA) {
        const tk = await tokenServicio(env);
        const ruta = "projects/" + env.FIREBASE_PROJECT + "/databases/(default)/documents/usuarios/" + env.ADMIN_UID + "?mask.fieldPaths=skydropx";
        const d = await (await fetch("https://firestore.googleapis.com/v1/" + ruta, { headers: { Authorization: "Bearer " + tk } })).json();
        const sk = d?.fields?.skydropx?.mapValue?.fields || {}, r = sk.remitente?.mapValue?.fields || {};
        const sv = k => r[k]?.stringValue || "";
        rem = { ciudad: sv("ciudad"), depto: sv("depto"), barrio: sv("barrio"), cp: sv("cp") };
        variante = Number(sk.variante?.integerValue || 0);
      }
    } catch {}
    remitenteCache = { t: Date.now(), v: { rem, variante } };
  }
  const { rem, variante } = remitenteCache.v;
  const sinT = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const c = sinT(rem.ciudad || "Bogota"), dp = sinT(rem.depto || "Cundinamarca"), esBog = /^bogota/i.test(c), barrio = sinT(rem.barrio), cp = String(rem.cp || "").replace(/\D/g, "");
  // Las mismas formas (y en el mismo orden) que usa el panel para cotizar
  const l = esBog ? [["Cundinamarca", "Bogota"], ["Bogota D.C.", "Bogota"], ["Bogota, D.C.", "Bogota, D.C."], ["Distrito Capital", "Bogota"], ["Bogota", "Bogota"], [dp, c]] : [[dp, c], [dp, c.split(",")[0]]];
  const vistos = new Set(), formas = l.filter(([a, b]) => { const k = a + "|" + b; if (vistos.has(k)) return false; vistos.add(k); return true; });
  const dir = (a1, a2, conCp) => ({ country_code: "co", ...(conCp ? { postal_code: cp } : {}), area_level1: a1, area_level2: a2, area_level3: barrio || a2 });
  const todas = [...(cp ? formas.map(([a, b]) => dir(a, b, true)) : []), ...formas.map(([a, b]) => dir(a, b, false)), ...(cp ? [] : formas.map(([a, b]) => ({ ...dir(a, b, false), postal_code: "110911" })))];
  // Primero la forma que ya funcionó en el panel
  const i = Math.min(Math.max(variante, 0), todas.length - 1);
  return [todas[i], ...todas.filter((_, j) => j !== i)];
}
// Cotiza un sobre de videojuego (22×19×4 cm, 1 kg, valor $50.000) desde Bogotá con Envía e Interrapidísimo.
// Devuelve la tarifa más barata de cada una; el catálogo la redondea a los mil de arriba.
const cacheCot = new Map();
const ALIAS_DEPTO_W = { "valle del cauca": ["Valle"], "la guajira": ["Guajira"], "san andres y providencia": ["San Andres", "Archipielago de San Andres"], "norte de santander": ["N. de Santander"] };
async function cotizarPublico(b, env, base, responder) {
  const traza = [];
  const limpio = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z .,()'-]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  const ciudad = limpio(b.ciudad), depto = limpio(b.depto);
  if (ciudad.length < 2 || depto.length < 2) return responder({ error: "Falta la ciudad" }, 400);
  const k = (ciudad + "|" + depto).toLowerCase();
  const c = cacheCot.get(k); if (c && !b.detalle && Date.now() - c.t < 6 * 3600e3) return responder(c.r);
  if (!env.SKYDROPX_CLIENT_ID || !env.SKYDROPX_CLIENT_SECRET) return responder({ error: "Faltan las credenciales de Skydropx en el Worker" }, 500);
  // Origen: el mismo remitente del panel (Firestore → skydropx.remitente), con las mismas formas que prueba el panel
  const origenes = await origenesRemitente(env);
  const deptos = [depto, ...(ALIAS_DEPTO_W[depto.toLowerCase()] || [])];
  const ciudades = [...new Set([ciudad, ciudad.replace(/\s*\(.*\)/, ""), ciudad.split(",")[0].trim()])];
  const destinos = []; deptos.forEach(d => ciudades.forEach(cc => destinos.push([d, cc])));
  const paquete = { length: 22, width: 19, height: 4, weight: 1 }, valor = 50000;
  try {
    let tk = await tokenDeSkydropx(env, base), iO = 0, iD = 0, conCarriers = true, q = null;
    for (let intento = 0; intento < 24 && !q; intento++) {
      const of = origenes[Math.min(iO, origenes.length - 1)], [d1, d2] = destinos[Math.min(iD, destinos.length - 1)];
      const cuerpo = { quotation: { address_from: of, address_to: { country_code: "co", area_level1: d1, area_level2: d2, area_level3: d2 },
        parcels: [{ ...paquete, declared_amount: valor }], declared_amount: valor, ...(conCarriers ? { requested_carriers: ["envia", "interrapidisimo"] } : {}) } };
      let r = await llamar(base, "/quotations", "POST", cuerpo, tk);
      if (r.status === 401) { tokenSkydropx.vence = 0; tk = await tokenDeSkydropx(env, base); r = await llamar(base, "/quotations", "POST", cuerpo, tk); }
      const j = await r.json().catch(() => ({}));
      const msg = JSON.stringify(j);
      traza.push({ intento, origen: [of.postal_code, of.area_level1, of.area_level2, of.area_level3].filter(Boolean).join("/"), destino: d1 + "/" + d2, carriers: conCarriers, estado: r.status, respuesta: r.ok ? undefined : msg.slice(0, 300) });
      if (r.ok) { q = j; break; }
      if (r.status !== 422) throw new Error("Skydropx respondió " + r.status);
      if (/requested_carriers/.test(msg) && conCarriers) { conCarriers = false; continue; }
      let avanzo = false;
      if (/address_from/.test(msg) && iO < origenes.length - 1) { iO++; avanzo = true; }
      else if (/address_from/.test(msg)) throw new Error("Skydropx no acepta la dirección de recogida: revisa ciudad, departamento y código postal del remitente en el panel");
      if (/address_to/.test(msg) && iD < destinos.length - 1) { iD++; avanzo = true; }
      if (!avanzo) throw new Error("Skydropx no reconoce " + ciudad + " - " + depto);
    }
    if (!q) throw new Error("Skydropx no aceptó la cotización");
    const id = q.id || q.data?.id;
    for (let i = 0; i < 12 && id && !(q.is_completed ?? q.data?.is_completed); i++) {
      await new Promise(ok => setTimeout(ok, 1200));
      const r = await llamar(base, "/quotations/" + id, "GET", null, tk); q = await r.json().catch(() => q);
    }
    let rates = (q.rates || q.data?.rates || []).filter(x => x && +(x.total || x.amount) > 0 && !/no_coverage|not_applicable|error/i.test(x.status || ""));
    const de = x => String(x.provider_name || x.provider_display_name || "").toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    // Por transportadora: las tarifas con "success: true" si las hay; si no, las que traen precio
    // (Interrapidísimo suele venir con precio y "success: false")
    const minimo = pref => { let l = rates.filter(x => de(x).startsWith(pref)); if (l.some(x => x.success === true)) l = l.filter(x => x.success === true);
      const v = l.map(x => Math.ceil(+(x.total || x.amount))); return v.length ? Math.min(...v) : null; };
    const res = { tarifas: { envia: minimo("envia"), inter: minimo("inter") } };
    if (res.tarifas.envia || res.tarifas.inter) cacheCot.set(k, { t: Date.now(), r: res });
    if (b.detalle) return responder({ ...res, completa: !!(q.is_completed ?? q.data?.is_completed), traza,
      tarifasSkydropx: (q.rates || q.data?.rates || []).map(x => ({ transportadora: x.provider_name || x.provider_display_name, servicio: x.provider_service_name, total: x.total || x.amount, estado: x.status, success: x.success })) });
    return responder(res);
  } catch (e) {
    return responder({ error: String(e.message || e).slice(0, 200), ...(b.detalle ? { traza } : {}) }, 502);
  }
}

// IA gratuita de Cloudflare (Workers AI). Con foto: modelo de visión; sin foto: modelo de texto.
const MODELO_VISION = "@cf/meta/llama-3.2-11b-vision-instruct";
const MODELO_TEXTO = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
async function iaCloudflare(env, texto, foto) {
  const correr = () => foto
    ? env.AI.run(MODELO_VISION, { messages: [{ role: "user", content: texto }], image: "data:" + foto.tipo + ";base64," + foto.datos, max_tokens: 900, temperature: 0.1 })
    : env.AI.run(MODELO_TEXTO, { messages: [{ role: "user", content: texto }], max_tokens: 2000, temperature: 0.6 });
  let r;
  try { r = await correr(); }
  catch (e) {
    // El modelo de visión de Meta pide aceptar su licencia una sola vez
    if (foto && /agree|licen/i.test(String(e.message || e))) { await env.AI.run(MODELO_VISION, { prompt: "agree" }).catch(() => {}); r = await correr(); }
    else throw e;
  }
  const t = r && (r.response ?? r.result?.response ?? r.text);
  return typeof t === "string" ? t : JSON.stringify(t ?? "");
}

function llamar(base, ruta, metodo, cuerpo, token) {
  return fetch(base + ruta, {
    method: metodo,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
    body: metodo === "GET" ? undefined : JSON.stringify(cuerpo || {})
  });
}

async function tokenDeSkydropx(env, base) {
  if (tokenSkydropx.valor && tokenSkydropx.base === base && Date.now() < tokenSkydropx.vence - 60000) return tokenSkydropx.valor;
  const pedir = extra => fetch(base + "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.SKYDROPX_CLIENT_ID, client_secret: env.SKYDROPX_CLIENT_SECRET, ...extra })
  });
  let r = await pedir({ redirect_uri: "urn:ietf:wg:oauth:2.0:oob", scope: "default orders.create" });
  if (!r.ok) r = await pedir({}); // si la cuenta no acepta ese alcance, sin alcance
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("Skydropx no entregó token (" + r.status + "): " + JSON.stringify(j).slice(0, 200));
  tokenSkydropx = { valor: j.access_token, vence: Date.now() + (Number(j.expires_in) || 7200) * 1000, base };
  return tokenSkydropx.valor;
}

/* ---------- verificación del token de Firebase (RS256) ---------- */
let llavesGoogle = { llaves: null, vence: 0 };
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
async function verificarFirebase(token, env) {
  if (!token) throw new Error("falta el token");
  const partes = token.split(".");
  if (partes.length !== 3) throw new Error("token mal formado");
  const [h, p, f] = partes;
  const cab = JSON.parse(new TextDecoder().decode(b64u(h)));
  const datos = JSON.parse(new TextDecoder().decode(b64u(p)));
  const ahora = Date.now() / 1000;
  if (cab.alg !== "RS256") throw new Error("algoritmo no válido");
  if (datos.aud !== env.FIREBASE_PROJECT || datos.iss !== "https://securetoken.google.com/" + env.FIREBASE_PROJECT) throw new Error("proyecto no válido");
  if (!(datos.exp > ahora) || datos.iat > ahora + 300) throw new Error("token vencido");
  if (datos.sub !== env.ADMIN_UID) throw new Error("solo la cuenta de despacho");
  if (!llavesGoogle.llaves || Date.now() > llavesGoogle.vence) {
    const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    llavesGoogle = { llaves: (await r.json()).keys || [], vence: Date.now() + 3600000 };
  }
  const jwk = llavesGoogle.llaves.find(k => k.kid === cab.kid);
  if (!jwk) throw new Error("llave desconocida");
  const llave = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", llave, b64u(f), new TextEncoder().encode(h + "." + p));
  if (!ok) throw new Error("firma no válida");
}

/* ---------- links cortos de Google Maps ---------- */
const HOSTS_MAPS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|www\.google\.[a-z.]+|google\.[a-z.]+)$/i;
async function expandirMaps(enlace) {
  let u = new URL(enlace.trim());
  for (let i = 0; i < 6; i++) {
    if (u.protocol !== "https:" || !HOSTS_MAPS.test(u.hostname)) throw new Error("solo links de Google Maps");
    const r = await fetch(u.toString(), { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } });
    const sig = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && sig) { u = new URL(sig, u); continue; }
    // Algunas páginas traen las coordenadas en el HTML (por ejemplo /@4.6,-74.1 o center=4.6%2C-74.1)
    if (!/@-?\d|[?&](q|ll|center|query)=-?\d|!3d-?\d|\/(search|place)\/-?\d/.test(u.toString())) {
      const html = (await r.text()).slice(0, 300000);
      const m = html.match(/@(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})/) || html.match(/center=(-?\d{1,2}\.\d{4,})%2C(-?\d{1,3}\.\d{4,})/) || html.match(/\[null,null,(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/);
      if (m) return "https://www.google.com/maps/@" + m[1] + "," + m[2] + ",17z";
    }
    return u.toString();
  }
  return u.toString();
}

/* ---------- Addi: pago a cuotas ---------- */
function addiUrls(env) {
  const pruebas = String(env.ADDI_AMBIENTE || "").toLowerCase().startsWith("prueba");
  return {
    auth: env.ADDI_AUTH_URL || (pruebas ? "https://auth.addi-staging.com/oauth/token" : "https://auth.addi.com/oauth/token"),
    audience: env.ADDI_AUDIENCE || (pruebas ? "https://api.staging.addi.com" : "https://api.addi.com"),
    api: env.ADDI_API_URL || (pruebas ? "https://api.addi-staging.com" : "https://api.addi.com")
  };
}
async function crearAddi(p, env, url) {
  if (!env.ADDI_CLIENT_ID || !env.ADDI_CLIENT_SECRET) throw new Error("faltan ADDI_CLIENT_ID y ADDI_CLIENT_SECRET en el Worker");
  const u = addiUrls(env);
  // Token nuevo en cada intento (así lo pide Addi)
  const rt = await fetch(u.auth, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ audience: u.audience, grant_type: "client_credentials", client_id: env.ADDI_CLIENT_ID, client_secret: env.ADDI_CLIENT_SECRET }) });
  const jt = await rt.json().catch(() => ({}));
  if (!rt.ok || !jt.access_token) throw new Error("no entregó token (" + rt.status + "): " + JSON.stringify(jt).slice(0, 200));
  const limpiar = (t, n) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 #\-.,]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const partes = String(p.nombre || "").trim().split(/\s+/);
  const nombre = partes.length > 2 ? partes.slice(0, partes.length - 2).join(" ") : partes[0] || "";
  const apellido = partes.length > 2 ? partes.slice(-2).join(" ") : partes.slice(1).join(" ") || partes[0] || "";
  const total = Math.round(Number(p.total) || 0), envio = Math.round(Number(p.envio) || 0);
  if (total < 1000) throw new Error("total no válido");
  const dir = { lineOne: limpiar(p.direccion, 100), city: limpiar(p.ciudad, 50), country: "CO" };
  const items = (p.items || []).map((x, i) => ({ sku: "PG" + (i + 1), name: limpiar(x.n, 100), quantity: String(x.q || 1), unitPrice: Math.round(x.v || 0), tax: 0, pictureUrl: "https://pipegames.com.co/mensajeria/logo-pipegames.jpg", category: "videojuegos" }));
  const propio = url.origin;
  const cuerpo = {
    orderId: String(p.orderId), totalAmount: String(total), shippingAmount: String(envio), totalTaxesAmount: "0", currency: "COP",
    items: items.length ? items : [{ sku: "PG1", name: "Pedido Pipe Games", quantity: "1", unitPrice: total - envio, tax: 0, pictureUrl: "https://pipegames.com.co/mensajeria/logo-pipegames.jpg", category: "videojuegos" }],
    client: { idType: "CC", idNumber: String(p.cedula || "").replace(/\D/g, ""), firstName: limpiar(nombre, 50), lastName: limpiar(apellido, 50), email: String(p.correo || "").trim(),
      cellphone: String(p.telefono || "").replace(/\D/g, "").slice(-10), cellphoneCountryCode: "+57", address: dir },
    shippingAddress: dir, billingAddress: dir,
    allyUrlRedirection: { logoUrl: "https://pipegames.com.co/mensajeria/logo-pipegames.jpg",
      callbackUrl: propio + "/addi/aviso?r=" + encodeURIComponent(p.reserva || "") + "&o=" + encodeURIComponent(p.orderId),
      redirectionUrl: "https://pipegames.com.co/mensajeria/saldo.html?addi=1" }
  };
  const r = await fetch(u.api + "/v1/online-applications", { method: "POST", redirect: "manual",
    headers: { Authorization: "Bearer " + jt.access_token, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(cuerpo) });
  const destino = r.headers.get("location");
  if ((r.status === 301 || r.status === 302 || r.status === 303) && destino) return { url: destino, orderId: cuerpo.orderId };
  const txt = await r.text().catch(() => "");
  throw new Error("respondió " + r.status + ": " + txt.slice(0, 400));
}
async function avisoAddi(req, env, url) {
  const cuerpoTxt = await req.text();
  const json = (d, st = 200) => new Response(d, { status: st, headers: { "Content-Type": "application/json" } });
  // Basic Auth con las credenciales de notificación de Addi
  const esperado = "Basic " + btoa((env.ADDI_NOTI_USER || "") + ":" + (env.ADDI_NOTI_PASS || ""));
  if (!env.ADDI_NOTI_USER || req.headers.get("Authorization") !== esperado) return json('{"error":"no autorizado"}', 401);
  let d = {}; try { d = JSON.parse(cuerpoTxt || "{}"); } catch {}
  const reserva = url.searchParams.get("r") || "";
  const estado = String(d.status || d.applicationStatus || "").toLowerCase();
  if (reserva && /^[A-Za-z0-9_-]{1,60}$/.test(reserva) && env.FIREBASE_SA) {
    // Solo se actualizan estos campos del crédito: el link (url, codigo, t) que creó el panel se conserva
    const credito = { estado, monto: Number(d.approvedAmount) || 0, solicitud: String(d.applicationId || ""), tAviso: Date.now() };
    const campos = { credito: { mapValue: { fields: aCamposFS(credito) } } };
    const mascara = Object.keys(credito).map(k => "credito." + k);
    if (estado === "approved") { campos.pagado = { integerValue: String(Date.now()) }; mascara.push("pagado"); }
    try { await escribirReserva(env, reserva, campos, mascara); } catch (e) { return json('{"error":"no se pudo guardar"}', 500); } // Addi reintenta
  }
  return json(cuerpoTxt || "{}"); // Addi espera la misma respuesta que envió
}
const aCamposFS = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : { stringValue: String(v) }]));
/* ---------- escritura en Firestore con la cuenta de servicio ---------- */
let tokenGoogle = { valor: "", vence: 0 };
async function tokenServicio(env) {
  if (tokenGoogle.valor && Date.now() < tokenGoogle.vence - 60000) return tokenGoogle.valor;
  const sa = JSON.parse(env.FIREBASE_SA);
  const ahora = Math.floor(Date.now() / 1000);
  const b64 = o => btoa(typeof o === "string" ? o : JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sinFirma = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: ahora, exp: ahora + 3600 });
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const llave = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", llave, new TextEncoder().encode(sinFirma)));
  const jwt = sinFirma + "." + btoa(String.fromCharCode(...firma)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Google no entregó token");
  tokenGoogle = { valor: j.access_token, vence: Date.now() + (j.expires_in || 3600) * 1000 };
  return tokenGoogle.valor;
}
async function escribirReserva(env, reserva, campos, mascara) {
  const tk = await tokenServicio(env);
  const ruta = "projects/" + env.FIREBASE_PROJECT + "/databases/(default)/documents/usuarios/" + env.ADMIN_UID;
  const campo = /^[A-Za-z_][A-Za-z0-9_]*$/.test(reserva) ? reserva : "`" + reserva + "`";
  const qs = mascara.map(m => "updateMask.fieldPaths=" + encodeURIComponent("reservas." + campo + "." + m)).join("&");
  const r = await fetch("https://firestore.googleapis.com/v1/" + ruta + "?" + qs, { method: "PATCH", headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { reservas: { mapValue: { fields: { [reserva]: { mapValue: { fields: campos } } } } } } }) });
  if (!r.ok) throw new Error("Firestore " + r.status + ": " + (await r.text()).slice(0, 200));
}

async function irAddi(env, url) {
  const html = (t) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:24px;text-align:center"><h2>Pipe Games</h2><p>${t}</p></body>`, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  const [reserva, codigo] = String(url.searchParams.get("c") || "").split(".");
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(reserva || "") || !/^[A-Za-z0-9]{8,40}$/.test(codigo || "") || !env.FIREBASE_SA) return html("Este link no es válido.");
  try {
    const tk = await tokenServicio(env);
    // Nombre de campo simple (letra inicial, letras y números) sin comillas; si no, entre comillas invertidas
    const campo = /^[A-Za-z_][A-Za-z0-9_]*$/.test(reserva) ? reserva : "`" + reserva + "`";
    const ruta = "projects/" + env.FIREBASE_PROJECT + "/databases/(default)/documents/usuarios/" + env.ADMIN_UID + "?mask.fieldPaths=" + encodeURIComponent("reservas." + campo + ".credito");
    const rr = await fetch("https://firestore.googleapis.com/v1/" + ruta, { headers: { Authorization: "Bearer " + tk } });
    const d = await rr.json().catch(() => ({}));
    if (!rr.ok) return html("No pudimos abrir el pago (código F" + rr.status + "). Escríbenos por WhatsApp.");
    const c = d?.fields?.reservas?.mapValue?.fields?.[reserva]?.mapValue?.fields?.credito?.mapValue?.fields || {};
    if (!c.url?.stringValue) return html("Este link no es válido (código A1: el pago aún no está autorizado). Escríbenos por WhatsApp.");
    if (c.codigo?.stringValue !== codigo) return html("Este link ya no es válido (código A2: se generó uno más nuevo). Escríbenos por WhatsApp y te lo reenviamos.");
    const t = Number(c.t?.integerValue || 0);
    if (Date.now() - t > 2 * 3600e3) return html("Este link venció (dura 2 horas). Escríbenos por WhatsApp y te enviamos uno nuevo.");
    return Response.redirect(c.url.stringValue, 302);
  } catch (e) { return html("No pudimos abrir el pago (código F0). Intenta de nuevo en un momento."); }
}
