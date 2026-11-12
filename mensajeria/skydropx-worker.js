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
// El panel le envía { metodo, ruta, cuerpo } y el Worker lo reenvía a Skydropx con su token.

const BASE_POR_DEFECTO = "https://pro.skydropx.com/api/v1";
const RUTAS_PERMITIDAS = /^\/(quotations|shipments|carriers|orders|labels|pickups|trackings?|addresses|packagings?|protect)(\/[A-Za-z0-9_-]+)*(\?[A-Za-z0-9_=&.%-]*)?$/;

let tokenSkydropx = { valor: "", vence: 0, base: "" };

export default {
  async fetch(req, env) {
    const origen = env.ORIGEN || "https://pipegames.com.co";
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
      return responder({ ok: true, base, credenciales: !!(env.SKYDROPX_CLIENT_ID && env.SKYDROPX_CLIENT_SECRET), firebase: !!env.FIREBASE_PROJECT, admin: !!env.ADMIN_UID });
    }
    if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);

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
