// Datos y utilidades compartidas entre panel, rastreo y app del mensajero.
import { URL_RASTREO, TOMTOM_KEY } from "./config.js?v=20261111f";

export const LOCALIDADES = [
  ["Usaquén", 4.7110, -74.0300], ["Chapinero", 4.6450, -74.0620], ["Santa Fe", 4.6030, -74.0680],
  ["San Cristóbal", 4.5650, -74.0850], ["Usme", 4.5050, -74.1100], ["Tunjuelito", 4.5780, -74.1350],
  ["Bosa", 4.6180, -74.1900], ["Kennedy", 4.6300, -74.1550], ["Fontibón", 4.6720, -74.1400],
  ["Engativá", 4.7050, -74.1120], ["Suba", 4.7480, -74.0850], ["Barrios Unidos", 4.6670, -74.0750],
  ["Teusaquillo", 4.6400, -74.0900], ["Los Mártires", 4.6050, -74.0900], ["Antonio Nariño", 4.5900, -74.1020],
  ["Puente Aranda", 4.6170, -74.1150], ["La Candelaria", 4.5960, -74.0730], ["Rafael Uribe Uribe", 4.5700, -74.1150],
  ["Ciudad Bolívar", 4.5450, -74.1550], ["Soacha", 4.5790, -74.2170], ["Chía", 4.8600, -74.0590]
];
export const NOMBRES_LOCALIDADES = LOCALIDADES.map(l => l[0]);
export const centroDe = nombre => { const l = LOCALIDADES.find(x => x[0] === nombre); return l ? { lat: l[1], lng: l[2] } : { lat: 4.65, lng: -74.10 }; };
export const BOGOTA = { lat: 4.6486, lng: -74.1000 };
// Localidad aproximada de un punto (la de centro más cercano).
// Ciudades donde se entrega. Soacha tiene la misma nomenclatura que Bogotá, por eso se busca aparte.
export const CIUDADES = {
  bogota: { nombre: "Bogotá", consulta: "Bogotá", centro: BOGOTA, bbox: [4.45, -74.25, 4.85, -73.99] },
  soacha: { nombre: "Soacha", consulta: "Soacha, Cundinamarca", centro: { lat: 4.5794, lng: -74.2168 }, bbox: [4.53, -74.32, 4.64, -74.16] },
  chia: { nombre: "Chía", consulta: "Chía, Cundinamarca", centro: { lat: 4.8619, lng: -74.0587 }, bbox: [4.81, -74.13, 4.95, -73.98] }
};
export const ciudadDeTexto = t => /\bsoacha\b/i.test(t || "") ? "soacha" : /(^|[^a-záéíóúñ])ch[ií]a([^a-záéíóúñ]|$)/i.test(t || "") ? "chia" : "";
export const quitarCiudad = t => String(t || "").replace(/[,\s-]*(\bsoacha\b|\bch[ií]a(?![a-záéíóúñ])|\bbogot[aá](\s*d\.?\s*c\.?)?(?![a-záéíóúñ]))(\s*,?\s*cundinamarca)?\.?\s*$/i, "").trim();
// Localidad que se guarda: en Bogotá, la localidad; fuera, el nombre del municipio
export const localidadEn = (ciudad, p) => ciudad && ciudad !== "bogota" ? CIUDADES[ciudad].nombre : localidadCercana(p);
// Aproximación de Chía: al norte del límite de Bogotá (calle 245 aprox.)
const enChia = p => p.lat > 4.835 && p.lng < -73.99;
// Aproximación del límite urbano de Soacha (sur-occidente de Bosa y Ciudad Bolívar)
const enSoacha = p => p.lat < 4.602 && p.lng < -74.183;

export function localidadCercana(p) {
  if (!p || p.lat == null) return "";
  if (enSoacha(p)) return "Soacha";
  if (enChia(p)) return "Chía";
  let mejor = "", d = Infinity;
  for (const [n, lat, lng] of LOCALIDADES) {
    const x = (lat - p.lat) ** 2 + (lng - p.lng) ** 2;
    if (x < d) { d = x; mejor = n; }
  }
  return mejor;
}

export const ESTADOS = {
  disponible: "Disponible",
  tomada: "Tomada",
  recogida: "Recogida",
  en_camino: "En camino",
  entregada: "Entregada",
  novedad: "Novedad",
  devuelta: "Devuelta",
  cancelada: "Cancelada"
};
export const PASOS = ["disponible", "recogida", "en_camino", "entregada"];
export const ACTIVOS = ["disponible", "tomada", "recogida", "en_camino", "novedad"];

export const MEDIOS = { efectivo: "Efectivo", nequi: "Nequi", pagado: "Sin cobro" };
export const TIPOS_ENVIO = ["Directo", "Contra entrega", "Mercado Libre", "Falabella", "Otros"];
// "Sin cobro" o "$215.000 contra entrega"
export function textoCobro(g) { return g.valor ? `${cop(g.valor)} contra entrega` : "Sin cobro"; }
// Referencia del marketplace: "Mercado Libre · Venta 2000… · Envío 4123…"
export function textoMarketplace(g) {
  const m = g.marketplace; if (!m || !(m.venta || m.envio)) return "";
  return [m.canal, m.venta ? `${m.canal === "Falabella" ? "Orden" : "Venta"} ${m.venta}` : "", m.envio ? `Envío ${m.envio}` : ""].filter(Boolean).join(" · ");
}
export function textoTipoEnvio(g) { return g.tipoEnvio === "Otros" && g.tipoEnvioOtro ? g.tipoEnvioOtro : (g.tipoEnvio || ""); }
export const RECIBE = { cliente: "Cliente", porteria: "Portería", familiar: "Familiar" };
export function textoRecibe(r) {
  if (!r || !r.tipo) return "";
  return RECIBE[r.tipo] + (r.nombre ? " · " + r.nombre : "");
}

// Dirección completa en texto, para navegar con Google Maps o Waze.
export function direccionTexto(d) {
  if (!d) return "";
  return [String(d.direccion || "").replace(/\b(apto|apt|ap|int|interior|torre|casa|oficina|of|piso|local)\b.*$/i, "").trim(), d.localidad, "Bogotá, Colombia"].filter(Boolean).join(", ");
}

// Avenidas con nombre propio: orientación (corre como carrera o como calle) y su número equivalente.
export const AVENIDAS = [
  { re: /\bciudad de cali\b|\bav(enida)?\.?\s+cali\b/i, nombre: "Ciudad de Cali", tipo: "carrera", num: "86" },
  { re: /\bboyac[aá](?![a-záéíóúñ])/i, nombre: "Boyacá", tipo: "carrera", num: "72" },
  { re: /\bcaracas\b/i, nombre: "Caracas", tipo: "carrera", num: "14" },
  { re: /\bnqs\b|norte[\s-]+quito[\s-]+sur|ciudad de quito/i, nombre: "(NQS|Norte Quito Sur|Ciudad de Quito)", tipo: "carrera", num: "30" },
  { re: /congreso eucar[ií]stico|\bav(enida)?\.?\s*68\b/i, nombre: "(Congreso Eucarístico|68)", tipo: "carrera", num: "68" },
  { re: /\brojas\b/i, nombre: "Rojas", tipo: "carrera", num: "70" },
  { re: /agoberto mej[ií]a/i, nombre: "Agoberto Mejía", tipo: "carrera", num: "80" },
  { re: /\bel ?dorado\b/i, nombre: "(El Dorado|Eldorado)", tipo: "calle", num: "26" },
  { re: /\bla esperanza\b|\besperanza\b/i, nombre: "(La Esperanza|Esperanza)", tipo: "calle", num: "24" },
  { re: /\bam[eé]ricas\b/i, nombre: "(Las Américas|Américas)", tipo: "calle", num: "6" },
  { re: /\bcentenario\b/i, nombre: "Centenario", tipo: "calle", num: "13" },
  { re: /\bjim[eé]nez\b/i, nombre: "Jiménez", tipo: "calle", num: "13" },
  { re: /\bchile\b/i, nombre: "Chile", tipo: "calle", num: "72" },
  { re: /pepe sierra/i, nombre: "Pepe Sierra", tipo: "calle", num: "116" },
  { re: /primero de mayo|1 de mayo/i, nombre: "Primero de Mayo", tipo: "calle", num: "22 Sur" }
];

// Convierte nomenclatura de Bogotá (Cra 15 # 93-47, Av Ciudad de Cali # 23-29) a datos para ubicarla en el mapa.
// tipo: "carrera" si la vía corre de sur a norte (sus placas cruzan calles), "calle" si corre de oriente a occidente.
// nombres: formas en que la vía puede aparecer en el mapa.
export function normalizarDireccion(dir) {
  const original = String(dir || "").replace(/\b(apto|apt|ap|int|interior|torre|casa|oficina|of|piso|local|bloque|conjunto|edificio)\b.*$/i, "");
  const placaRe = /#?\s*(\d+\s*[A-Z]?(?:\s*Bis)?)\s*-\s*(\d+)(\s*Sur|\s*Este)?/i;
  // 1) Avenida con nombre propio
  for (const av of AVENIDAS) {
    if (!av.re.test(original)) continue;
    const resto = original.replace(av.re, " ").replace(/\s*(No\.?|N°|Nº|numero|número)\s*/gi, " # ");
    const m = resto.match(placaRe);
    const nombreTxt = av.nombre.replace(/[()]/g, "").split("|")[0];
    const via = `Avenida ${nombreTxt}`;
    if (!m) return { texto: via, via: null };
    const placa = `${m[1].replace(/\s+/g, "")}-${m[2]}`;
    const sufijo = (m[3] || "").trim();
    const numEq = av.tipo === "carrera" ? `Carrera ${av.num}` : `Calle ${av.num}`;
    return { texto: `${via} # ${placa}${sufijo ? " " + sufijo : ""}`, via, placa, sufijo, tipo: av.tipo, nombres: [`${av.nombre}`, numEq] };
  }
  // 2) Nomenclatura con número
  let t = " " + original + " ";
  const vias = [
    [/\b(av(enida)?\.?\s*(cra|kra|kr|carrera)|ak)\b\.?/gi, "Avenida Carrera"],
    [/\b(av(enida)?\.?\s*(cll|cl|calle)|ac)\b\.?/gi, "Avenida Calle"],
    [/\b(carrera|cra|kra|kr|cr|crr)\b\.?/gi, "Carrera"],
    [/\b(calle|cll|cl|clle)\b\.?/gi, "Calle"],
    [/\b(diagonal|diag|dg)\b\.?/gi, "Diagonal"],
    [/\b(transversal|transv|trans|tv|tr)\b\.?/gi, "Transversal"]
  ];
  for (const [re, v] of vias) t = t.replace(re, v);
  t = t.replace(/\s*(#|No\.?|N°|Nº|numero|número)\s*/gi, " # ").replace(/\s+/g, " ").trim();
  const m = t.match(/(Avenida Carrera|Avenida Calle|Carrera|Calle|Diagonal|Transversal)\s+(\d+\s*[A-Z]?(?:\s*Bis)?(?:\s*[A-Z])?(?:\s*Sur|\s*Este)?)\s*#?\s*(\d+\s*[A-Z]?(?:\s*Bis)?)\s*-\s*(\d+)(\s*Sur|\s*Este)?/i);
  if (!m) return { texto: t, via: null };
  const via = `${m[1]} ${m[2].replace(/\s+/g, " ").trim()}`;
  const placa = `${m[3].replace(/\s+/g, "")}-${m[4]}`;
  const sufijo = (m[5] || "").trim();
  const base = m[1].replace(/^Avenida /i, "");
  const num = m[2].replace(/\s+/g, " ").trim();
  const tipo = /carrera|transversal/i.test(base) ? "carrera" : "calle";
  const nombres = [`${base} ${num}`];
  const av = AVENIDAS.find(a => a.num.toLowerCase() === num.toLowerCase() && a.tipo === tipo && /^(carrera|calle)$/i.test(base));
  if (av) nombres.push(av.nombre);
  return { texto: `${via} # ${placa}${sufijo ? " " + sufijo : ""}`, via, placa, sufijo, tipo, nombres };
}

// Extrae coordenadas de un texto o de un enlace de Google Maps.
export function leerCoordenadas(t) {
  t = String(t || "");
  const pats = [/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i, /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{2,3}\.\d{3,})/];
  for (const re of pats) {
    const m = t.match(re);
    if (m) {
      const lat = +m[1], lng = +m[2];
      if (lat > 4.2 && lat < 5.1 && lng > -74.5 && lng < -73.8) return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    }
  }
  return null;
}

// Número de guía a partir de lo escaneado (QR con link de rastreo o código de barras).
export function guiaDesdeEscaneo(v) {
  const m = String(v || "").toUpperCase().match(/[A-Z][A-Z0-9]{1,19}-\d{5}\b|BOG-[A-Z0-9]{6}/);
  return m ? m[0] : null;
}

export function cop(v) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);
}
export function fecha(t) {
  if (!t) return "";
  return new Date(t).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function hace(t) {
  if (!t) return "sin señal";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "hace segundos";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : fecha(t);
}
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function km(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, r = x => x * Math.PI / 180;
  const dl = r(b.lat - a.lat), dn = r(b.lng - a.lng);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Etiqueta de Mercado Envíos Flex: datos a partir de las líneas de texto de una página del PDF.
export function leerEtiquetaML(lineas) {
  const t = lineas.join("\n");
  const campo = re => { const m = t.match(re); return m ? m[1].replace(/\s+/g, " ").trim() : ""; };
  const envio = (t.match(/Env[ií]o:\s*([\d\s]{6,20})/i)?.[1] || "").replace(/\D/g, "");
  if (!envio) return null;
  const direccionTxt = campo(/Direcci[oó]n:\s*(.+)/i);
  const barrio = campo(/Distrito:\s*(.+)/i);
  const refs = [...t.matchAll(/Referencia:\s*(.+?)(?=\s*Referencia:|\n|$)/gi)].map(m => m[1].trim()).filter(Boolean);
  const dest = campo(/Destinatario:\s*(.+)/i);
  const usuario = dest.match(/\(([^)]+)\)\s*$/)?.[1] || "";
  const nombre = dest.replace(/\s*\([^)]*\)\s*$/, "").trim();
  // "Calle 147 #11-10, Usaquén" → dirección y localidad escrita
  const partes = direccionTxt.split(/,\s*/);
  const localidadTxt = partes.length > 1 ? partes.pop() : "";
  const direccion = partes.join(", ");
  const flex = /\bFLEX\b/.test(t);
  const zona = campo(/(ZONA\s*\d+)/i);
  return { canal: "Mercado Libre", envio, nombre, usuario, telefono: "", direccion, localidadTxt, barrio, referencia: [barrio, ...refs].filter(Boolean).join(" · "), nota: usuario ? "Usuario Mercado Libre: " + usuario : "", flex, zona };
}

// Etiqueta de Falabella (Despacho directo): DIRECCION, CLIENTE, F.PACTADA, TELEFONO, REFERENCIA y número del código de barras.
export function leerEtiquetaFalabella(lineas) {
  const t = lineas.join("\n");
  const ETIQ = ["DIRECCION", "DIRECCIÓN", "CLIENTE", "F\\.PACTADA", "TELEFONO", "TELÉFONO", "N° DE BULTOS", "Nº DE BULTOS", "REFERENCIA"];
  const sig = `(?=\\n?\\s*(?:${ETIQ.join("|")}):|\\n\\s*\\d{12,22}\\s*$|$)`;
  const campo = nombre => { const m = t.match(new RegExp(`(?:${nombre}):[ \\t]*([\\s\\S]*?)${sig}`, "i")); return m ? m[1].replace(/\s+/g, " ").trim() : ""; };
  const envio = (t.match(/(?:^|\n)\s*(\d{12,22})\s*(?:\n|$)/g) || []).map(x => x.trim()).pop() || "";
  const direccionTxt = campo("DIRECCION|DIRECCIÓN");
  const nombre = campo("CLIENTE");
  if (!envio || !direccionTxt) return null;
  // "carrera 53 # 103b - 70 , Torres de Penuel II Apto 506" → dirección y complemento
  const [direccion, ...resto] = direccionTxt.split(/\s*,\s*/);
  const pactada = campo("F\\.PACTADA");
  const fecha = pactada && !isNaN(Date.parse(pactada)) ? new Date(pactada).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : pactada;
  const referencia = [resto.join(", "), campo("REFERENCIA")].filter(Boolean).join(" · ");
  return { canal: "Falabella", envio, nombre, telefono: campo("TELEFONO|TELÉFONO").replace(/[^\d+]/g, ""), direccion: direccion.trim(), localidadTxt: "", referencia, nota: fecha ? "Entrega pactada con Falabella: " + fecha : "", bultos: campo("N° DE BULTOS|Nº DE BULTOS") };
}

// Código de la etiqueta del marketplace: QR de Mercado Envíos ({"id":"48475358507",…}) o número de envío / código de barras de Falabella
export function envioMLDesdeEscaneo(v) {
  const s = String(v || "").trim();
  try { const j = JSON.parse(s); if (j && j.id && /^\d{8,22}$/.test(String(j.id))) return String(j.id); } catch {}
  const d = s.replace(/\s/g, "");
  return /^\d{10,22}$/.test(d) ? d : null;
}

// Número de guía con el nombre de la tienda y consecutivo de 5 cifras: PIPEGAMES-00001
export function prefijoTienda(nombre) {
  return String(nombre || "GUIA").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || "GUIA";
}
export const numeroGuia = (prefijo, k) => `${prefijo}-${String(k).padStart(5, "0")}`;
export const esNumeroGuia = n => /^[A-Z][A-Z0-9]{1,19}-\d{5}$|^BOG-[A-Z0-9]{6}$/.test(n);
export function nuevoNumero() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "BOG-";
  const v = crypto.getRandomValues(new Uint32Array(6));
  for (let i = 0; i < 6; i++) s += A[v[i] % A.length];
  return s;
}
export function nuevoCodigo() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const v = crypto.getRandomValues(new Uint32Array(6));
  let s = "";
  for (let i = 0; i < 6; i++) s += A[v[i] % A.length];
  return s;
}
// Clave de rastreo: sin ella no se puede ver la guía (los números van en orden).
// Si la guía tiene celular, son sus últimos 4 dígitos; si no (Mercado Libre, Falabella),
// un código de 6 caracteres que va impreso en la etiqueta.
export const nuevaClave = nuevoCodigo;
export function claveDeseada(g) {
  const d = String(g.telefono || "").replace(/\D/g, "");
  if (d.length >= 7) return d.slice(-4);
  return g.clave && g.clave.length === 6 ? g.clave : nuevoCodigo();
}
export const esClaveCodigo = c => /^[A-Z0-9]{6}$/.test(c || "");

// Contraseña de acceso al panel (número de documento de la empresa), guardada solo como huella.
export async function huellaAcceso(numeroDocumento) {
  const d = String(numeroDocumento || "").replace(/\D/g, "");
  const te = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", te.encode(d), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: te.encode("mensajeria-acceso-v1"), iterations: 150000 }, k, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export const idRastreo = g => `${g.numero}_${g.clave}`;
// Formulario donde el cliente escribe sus datos de envío (misma carpeta que el rastreo)
export const URL_ENVIO = URL_RASTREO.replace(/rastreo\.html$/, "envio.html");
export const linkRastreo = g => `${URL_RASTREO}?g=${encodeURIComponent(g.numero)}&c=${encodeURIComponent(g.clave || "")}`;

// Número colombiano a formato internacional para WhatsApp.
export function telWhatsApp(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (d.startsWith("0057")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("3")) d = "57" + d;
  return d;
}
export function linkWhatsApp(tel, texto) {
  return `https://wa.me/${telWhatsApp(tel)}?text=${encodeURIComponent(texto)}`;
}
export function primerNombre(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }

// Valor para mensajes de WhatsApp: solo caracteres simples (sin espacios especiales ni emojis)
export const copTxt = v => "$" + Math.round(v || 0).toLocaleString("es-CO");
export function mensajeEnCamino(g, linkFn = linkRastreo) {
  let t = `Hola ${primerNombre(g.cliente)}, tu pedido ${g.numero} de ${g.remitente || "la tienda"} va en camino con ${primerNombre(g.mensajeroNombre) || "nuestro mensajero"}. Síguelo aquí: ${linkFn(g)}`;
  if (g.valor > 0) t += `. Valor a pagar: ${copTxt(g.valor)}.`;
  else t += ".";
  return t;
}
export function mensajeEntregado(g, linkFn = linkRastreo) {
  return `Hola ${primerNombre(g.cliente)}, tu pedido ${g.numero} fue entregado. Puedes ver la foto de entrega aquí: ${linkFn(g)}. ¡Gracias por tu compra!`;
}

// Vista pública de una guía (lo que se guarda en /rastreo).
// Si se pasa `foto` (o null para borrarla), se incluye; si no, la que haya se conserva (escribir con merge).
// `extras`: fotos adicionales de la entrega (hasta 2 más). Al borrar la foto (null) también se borran.
export function vistaPublica(g, foto, extras) {
  const v = {
    numero: g.numero,
    estado: g.estado,
    remitente: g.remitente || "",
    clienteNombre: primerNombre(g.cliente),
    localidad: g.destino?.localidad || "",
    destino: g.destino ? { lat: g.destino.lat, lng: g.destino.lng } : null,
    valor: g.valor || 0,
    tipoEnvio: textoTipoEnvio(g),
    mensajeroId: g.mensajeroId || null,
    mensajeroNombre: g.mensajeroNombre || "",
    mensajeroPlaca: g.mensajeroPlaca || "",
    eventos: (g.eventos || []).map(e => ({ estado: e.estado, t: e.t })),
    tieneFoto: g.estado === "entregada",
    recibe: g.estado === "entregada" && g.recaudo?.recibe ? g.recaudo.recibe.tipo : "",
    actualizado: Date.now()
  };
  if (foto !== undefined) v.foto = foto;
  if (extras !== undefined) v.fotosExtra = extras;
  else if (foto === null) v.fotosExtra = [];
  return v;
}

export function evento(estado, nota = "", por = "") {
  return { estado, t: Date.now(), nota, por };
}

// Comprime una imagen (File) a JPEG de máximo `max` px. Devuelve data URL.
export function comprimirImagen(file, max = 1100, calidad = 0.62) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No se pudo leer la foto")); };
    img.src = url;
  });
}

// Capa del mapa. En pipegames.com.co (panel y rastreo) usa el mapa de TomTom; en la app, OpenStreetMap.
// Si TomTom no responde, cambia sola a OpenStreetMap para que el mapa nunca quede en blanco.
function capaOSM(L) {
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
}
export function capaMapa(L) {
  const enDominio = /(^|\.)pipegames\.com\.co$/.test(location.hostname);
  if (!enDominio || !TOMTOM_KEY) {
    const c = capaOSM(L);
    c.on("add", e => { try { e.target._map.attributionControl?.setPrefix(false); } catch {} });
    return c;
  }
  const capa = L.tileLayer(`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?view=Unified&key=${TOMTOM_KEY}`, {
    maxZoom: 19, attribution: "&copy; TomTom", crossOrigin: true
  });
  let cargadas = 0, fallas = 0, cambiada = false;
  capa.on("tileload", () => { cargadas++; });
  capa.on("tileerror", () => {
    fallas++;
    if (!cambiada && cargadas === 0 && fallas >= 3 && capa._map) {
      cambiada = true;
      const m = capa._map;
      m.removeLayer(capa);
      capaOSM(L).addTo(m);
      console.warn("TomTom no cargó el mapa; se usa OpenStreetMap.");
    }
  });
  capa.on("add", e => { try { e.target._map.attributionControl?.setPrefix(false); } catch {} });
  return capa;
}
export function icono(L, tipo, texto = "") {
  const s = tipo === "mensajero" ? 32 : 26;
  return L.divIcon({
    className: "",
    html: `<div class="mk mk-${tipo}" style="width:${s}px;height:${s}px"><span>${esc(texto)}</span></div>`,
    iconSize: [s, s],
    iconAnchor: tipo === "destino" ? [s / 2, s] : [s / 2, s / 2]
  });
}
export const iniciales = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

export function mensajeError(e) {
  const c = e?.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Correo o contraseña incorrectos.";
  if (c.includes("email-already-in-use")) return "Ese correo ya tiene una cuenta. Inicia sesión.";
  if (c.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (c.includes("invalid-email")) return "El correo no es válido.";
  if (c.includes("permission-denied")) return "No tienes permiso para esta acción. Revisa que las reglas de seguridad estén publicadas.";
  if (c.includes("unavailable") || c.includes("network")) return "Sin conexión a internet. Intenta de nuevo.";
  return e?.message || "Ocurrió un error.";
}

/* ---------- Simulador de cobros (mismas reglas del catálogo pipegames.com.co) ---------- */
// Si cambian en el catálogo (index.html: ENVIO_LOCAL_VALOR, SIM_METODOS, SIM_LIMITE_CREDITO), cambiarlas aquí también.
export const ENVIO_LOCAL = 10000; // domicilio en Bogotá, Chía y Soacha
export const LIMITE_CREDITO = 1000000; // desde este monto no aplican Addi ni Sistecrédito
export const METODOS_PAGO = [
  { id: "transf", t: "Transferencia · Llave Bre-B", d: "Sin recargo", calc: b => b },
  { id: "tarjeta", t: "Tarjeta de crédito · Link de pago", d: "Recargo 3.59% + $900", calc: b => Math.ceil((b + 900) / (1 - 0.0359)) },
  { id: "addi", t: "Addi · Pago a cuotas", d: "Recargo 7.7% · requiere cédula y correo", calc: b => Math.ceil(b / 0.92265), credito: true },
  { id: "siste", t: "Sistecrédito · Pago a cuotas", d: "Recargo 5% · requiere cédula y correo", calc: b => Math.ceil(b / (1 - 0.05)), credito: true },
  { id: "contraentrega", t: "Contra entrega", d: "Paga al recibir · efectivo o Nequi", calc: b => b }
];
