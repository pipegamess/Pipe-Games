// Datos y utilidades compartidas entre panel, rastreo y app del mensajero.
import { URL_RASTREO } from "./config.js";

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
export function localidadCercana(p) {
  if (!p || p.lat == null) return "";
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
export const PASOS = ["disponible", "tomada", "recogida", "en_camino", "entregada"];
export const ACTIVOS = ["disponible", "tomada", "recogida", "en_camino", "novedad"];

export const MEDIOS = { efectivo: "Efectivo", nequi: "Nequi", pagado: "Ya estaba pago" };
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

// Convierte nomenclatura de Bogotá (Cra 15 # 93-47) a una forma que entiende el buscador de mapas.
export function normalizarDireccion(dir) {
  let t = " " + String(dir || "").replace(/\b(apto|apt|ap|int|interior|torre|casa|oficina|of|piso|local|bloque|conjunto|edificio)\b.*$/i, "") + " ";
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
  return { texto: `${via} # ${placa}${sufijo ? " " + sufijo : ""}`, via, placa, sufijo };
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
  const m = String(v || "").toUpperCase().match(/BOG-[A-Z0-9]{6}/);
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
export const linkRastreo = numero => `${URL_RASTREO}?g=${encodeURIComponent(numero)}`;

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

export function mensajeEnCamino(g, linkFn = linkRastreo) {
  let t = `Hola ${primerNombre(g.cliente)}, tu pedido ${g.numero} de ${g.remitente || "la tienda"} va en camino con ${primerNombre(g.mensajeroNombre) || "nuestro mensajero"}. Síguelo aquí: ${linkFn(g.numero)}`;
  if (g.valor > 0) t += `. Valor a pagar: ${cop(g.valor)}.`;
  else t += ".";
  return t;
}
export function mensajeEntregado(g, linkFn = linkRastreo) {
  return `Hola ${primerNombre(g.cliente)}, tu pedido ${g.numero} fue entregado. Puedes ver la foto de entrega aquí: ${linkFn(g.numero)}. ¡Gracias por tu compra!`;
}

// Vista pública de una guía (lo que se guarda en /rastreo).
export function vistaPublica(g) {
  return {
    numero: g.numero,
    estado: g.estado,
    remitente: g.remitente || "",
    clienteNombre: primerNombre(g.cliente),
    localidad: g.destino?.localidad || "",
    destino: g.destino ? { lat: g.destino.lat, lng: g.destino.lng } : null,
    valor: g.valor || 0,
    mensajeroId: g.mensajeroId || null,
    mensajeroNombre: g.mensajeroNombre || "",
    mensajeroPlaca: g.mensajeroPlaca || "",
    eventos: (g.eventos || []).map(e => ({ estado: e.estado, t: e.t })),
    tieneFoto: g.estado === "entregada",
    recibe: g.estado === "entregada" && g.recaudo?.recibe ? g.recaudo.recibe.tipo : "",
    actualizado: Date.now()
  };
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

// Capa de mapa de OpenStreetMap con atribución.
export function capaMapa(L) {
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
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
