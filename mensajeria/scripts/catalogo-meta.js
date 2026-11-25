// Genera catalogo-meta.csv (lista de productos para Meta: catálogo de WhatsApp / Facebook / Instagram)
// a partir del catálogo (index.html) y del stock en vivo (stock.json), con la misma regla de disponibilidad
// que usa el catálogo. Las fotos se guardan en catalogo-meta/ en 800x800 (Meta pide mínimo 500x500).
// Lo corre GitHub Actions cuando cambian el catálogo o el stock (.github/workflows/catalogo-meta.yml).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..", "..");
const SITIO = "https://pipegames.com.co";
const DIR_IMG = path.join(RAIZ, "catalogo-meta");
let sharp = null;
try { sharp = require("sharp"); } catch { console.log("Sin sharp: las fotos externas se enlazan tal cual"); }

const catalogo = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
const mMapa = catalogo.match(/^const PG_STOCK_MAP = (\{.*\});\s*$/m);
const STOCK_MAP = mMapa ? JSON.parse(mMapa[1]) : {};
const llave = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const llavePlat = v => { const x = llave(v); return ({ SW2: "SWITCH2", NS2: "SWITCH2", SW: "SWITCH", NS: "SWITCH" })[x] || x; };

let stock = {};
try { stock = JSON.parse(fs.readFileSync(path.join(RAIZ, "stock.json"), "utf8")).productos || {}; } catch {}
const usarStock = Object.keys(stock).length >= 50; // misma protección del catálogo

// Mayúsculas de títulos: Meta rechaza títulos todo en mayúsculas
const SIGLAS = new Set(["GTA", "FIFA", "EA", "FC", "NBA", "NFL", "NHL", "WWE", "MLB", "UFC", "PS4", "PS5", "PS", "DLC", "VR", "HD", "2K", "GT", "USB", "HDMI", "RGB", "LED", "SSD", "OLED", "XL", "F1", "WRC", "MX", "PGA", "TV", "DS", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XV", "XVI", "EAFC", "MVP", "PVZ", "AC", "LOL", "SD", "GB", "TB", "PC", "4K", "3D", "AAA", "DX", "NS", "SW", "SW2"]);
const MINUS = new Set(["de", "del", "la", "las", "el", "los", "y", "en", "of", "and", "con", "para", "por", "o", "to", "in", "on"]);
function titulo(t) {
  return String(t).trim().split(/(\s+|-|:|\/|\(|\))/).map((w, i) => {
    if (!/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]/.test(w)) return w;
    const u = w.toUpperCase(), l = w.toLowerCase();
    if (SIGLAS.has(u.replace(/[^A-Z0-9]/g, "")) || /\d/.test(w)) return u;
    if (i > 0 && MINUS.has(l)) return l;
    return l.charAt(0).toUpperCase() + l.slice(1);
  }).join("");
}
const csv = v => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const marca = p => /PS|PLAY/i.test(p) ? "PlayStation" : /SWITCH|NINTENDO|NS|SW/i.test(p) ? "Nintendo" : "Pipe Games";

async function foto(src) {
  src = String(src || "");
  if (!src) return "";
  const h = crypto.createHash("sha1").update(src).digest("hex").slice(0, 16);
  const archivo = path.join(DIR_IMG, h + ".jpg"), url = `${SITIO}/catalogo-meta/${h}.jpg`;
  if (fs.existsSync(archivo)) return url;
  let buf = null;
  if (src.startsWith("data:image/")) buf = Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  else if (/^https?:\/\//.test(src)) {
    if (!sharp) return src;
    try { const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } }); if (r.ok) buf = Buffer.from(await r.arrayBuffer()); } catch {}
    if (!buf) return src; // si no se puede bajar, se enlaza la original
  }
  if (!buf) return "";
  fs.mkdirSync(DIR_IMG, { recursive: true });
  if (sharp) {
    try { buf = await sharp(buf).resize(800, 800, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer(); }
    catch { if (!src.startsWith("data:")) return src; }
  }
  fs.writeFileSync(archivo, buf);
  return url;
}

(async () => {
  const filas = [], usadas = new Set(), ids = new Set();
  const categoria = { ps4: "Videojuegos", ps5: "Videojuegos", sw: "Videojuegos", acc: "Accesorios" };
  for (const lista of ["ps4", "ps5", "sw", "acc"]) {
    const m = catalogo.match(new RegExp("^const " + lista + " = (\\[.*\\]);\\s*$", "m"));
    if (!m) { console.error("No encontré la lista " + lista); process.exit(1); }
    for (const x of JSON.parse(m[1])) {
      const v = parseInt(String(x.price || "").replace(/\D/g, ""), 10) || 0;
      if (!x.name || !/[A-Za-z0-9]/.test(x.name) || !v) continue; // sin nombre real (ej. ".") no va a Meta
      const plat = x.platform || lista.toUpperCase(), nk = x.name + "|" + plat;
      const enlazado = Object.prototype.hasOwnProperty.call(STOCK_MAP, nk);
      const k = enlazado ? STOCK_MAP[nk] : llave(x.name) + "|" + llavePlat(plat);
      // Disponibilidad: misma regla del catálogo (aplicarStockExcel)
      let activo = x.active !== false;
      if (usarStock) {
        let c;
        if (Array.isArray(k)) {
          // mismo producto con varios nombres en el Excel (p. ej. stock actual + pedido en importación)
          const vals = k.map(x => stock[x]).filter(v => v !== undefined);
          if (vals.length) {
            const disp = vals.filter(v => v > 0).reduce((a, v) => a + v, 0);
            c = disp > 0 ? disp : (vals.some(v => v < 0) ? -1 : 0);
          }
        } else c = stock[k];
        if (c === undefined && enlazado) c = 0;
        if (c !== undefined) activo = c > 0; // c < 0: solo EN IMPORTACION (aún no llega): no disponible
      }
      let id = (Array.isArray(k) ? k[0] : k).replace(/\|/g, "-");
      while (ids.has(id)) id += "-2";
      ids.add(id);
      const img = await foto(x.img);
      if (img.includes("/catalogo-meta/")) usadas.add(path.basename(img));
      const nombre = titulo(x.name), cat = /CONSOLA/i.test(x.name) ? "Consolas" : categoria[lista];
      filas.push({
        id, title: `${nombre} - ${plat}`.slice(0, 150),
        description: `${nombre} para ${plat}. ${/OPEN\s*BOX/i.test(x.name) ? "Open Box: caja abierta, producto original revisado." : cat === "Videojuegos" ? "Juego físico nuevo y sellado de fábrica." : "Producto nuevo y sellado de fábrica."} Envíos a toda Colombia; domicilio en Bogotá, Chía y Soacha.`,
        availability: activo ? "in stock" : "out of stock", condition: /OPEN\s*BOX/i.test(x.name) ? "used" : "new", price: `${v} COP`,
        link: `${SITIO}/?pedido=${encodeURIComponent(JSON.stringify([{ n: x.name, p: plat, q: 1 }]))}`,
        image_link: img, brand: marca(plat), product_type: `${cat} > ${plat}`
      });
    }
  }
  const cols = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "product_type"];
  const salida = [cols.join(","), ...filas.map(f => cols.map(c => csv(f[c])).join(","))].join("\n") + "\n";
  const destino = path.join(RAIZ, "catalogo-meta.csv");
  const antes = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : "";
  if (antes !== salida) fs.writeFileSync(destino, salida);
  paginaStock(filas);
  // Borra fotos que ya no usa ningún producto
  if (fs.existsSync(DIR_IMG)) for (const f of fs.readdirSync(DIR_IMG)) if (f.endsWith(".jpg") && !usadas.has(f)) fs.unlinkSync(path.join(DIR_IMG, f));
  console.log(`catalogo-meta.csv: ${filas.length} productos (${filas.filter(f => f.availability === "in stock").length} disponibles)${antes === salida ? " · sin cambios" : ""}`);
})();

// Página de texto simple (pipegames.com.co/stock/) para que el agente de IA de WhatsApp (Meta Business Agent)
// la lea como "sitio web": cada producto con consola, precio y si está disponible o agotado.
function paginaStock(filas) {
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const precio = f => "$" + Number(f.price.replace(/\D/g, "")).toLocaleString("es-CO");
  const plat = f => f.product_type.split(" > ").pop();
  const orden = ["PS5", "PS4", "SWITCH 2", "SWITCH"];
  const grupos = {};
  for (const f of filas) (grupos[plat(f)] ||= []).push(f);
  const claves = Object.keys(grupos).sort((a, b) => ((orden.indexOf(a) + 1) || 99) - ((orden.indexOf(b) + 1) || 99) || a.localeCompare(b));
  const lista = (arr) => arr.length ? "<ul>\n" + arr.map(f => `<li>${esc(f.title)}: ${precio(f)}</li>`).join("\n") + "\n</ul>" : "<p>Ninguno.</p>";
  let cuerpo = "";
  for (const k of claves) {
    const g = grupos[k].sort((a, b) => a.title.localeCompare(b.title, "es"));
    const si = g.filter(f => f.availability === "in stock"), no = g.filter(f => f.availability !== "in stock");
    cuerpo += `<h2>${esc(k)}</h2>\n<h3>${esc(k)}: disponibles (${si.length})</h3>\n${lista(si)}\n<h3>${esc(k)}: agotados, NO disponibles (${no.length})</h3>\n${lista(no)}\n`;
  }
  const total = filas.filter(f => f.availability === "in stock").length;
  const contenido = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pipe Games - Stock y precios actualizados</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;line-height:1.45}h2{margin-top:2em;border-bottom:2px solid #ccc}li{margin:2px 0}</style>
</head><body>
<h1>Pipe Games - Stock y precios actualizados</h1>
<p>Lista oficial de disponibilidad de Pipe Games, tienda virtual de videojuegos en Bogotá, Colombia. Se actualiza automáticamente con el inventario. Actualizado: __FECHA__ (hora Colombia).</p>
<p>Reglas: los precios están en pesos colombianos (COP). Los juegos son físicos, nuevos y sellados, salvo que el nombre diga otra cosa (por ejemplo Open Box). Un producto que aparece como "agotado" NO está disponible y no se debe ofrecer; si no aparece en esta lista, tampoco está disponible. Antes de cerrar una compra, la disponibilidad la confirma Felipe. Catálogo con fotos y pedidos: https://pipegames.com.co</p>
<p>Total disponibles: ${total} de ${filas.length} productos.</p>
${cuerpo}</body></html>
`;
  const dir = path.join(RAIZ, "stock"), destino = path.join(dir, "index.html");
  // Versión CSV para subirla como archivo al agente de WhatsApp (pipegames.com.co/stock/stock.csv)
  const filasCsv = [...filas].sort((a, b) => ((orden.indexOf(plat(a)) + 1) || 99) - ((orden.indexOf(plat(b)) + 1) || 99) || (a.availability === "in stock" ? 0 : 1) - (b.availability === "in stock" ? 0 : 1) || a.title.localeCompare(b.title, "es"))
    .map(f => [f.title.replace(/ - [^-]+$/, ""), plat(f), Number(f.price.replace(/\D/g, "")), f.availability === "in stock" ? "DISPONIBLE" : "AGOTADO - NO OFRECER"].map(csv).join(","));
  const salidaCsv = "\ufeffProducto,Consola,Precio COP,Estado\n" + filasCsv.join("\n") + "\n";
  fs.mkdirSync(dir, { recursive: true });
  const dCsv = path.join(dir, "stock.csv");
  if (!fs.existsSync(dCsv) || fs.readFileSync(dCsv, "utf8") !== salidaCsv) fs.writeFileSync(dCsv, salidaCsv);
  const antes = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : "";
  const sinFecha = t => t.replace(/Actualizado: [^(]*\(/, "Actualizado: (");
  if (sinFecha(antes) === sinFecha(contenido)) return; // solo se reescribe si cambió algo además de la fecha
  const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(destino, contenido.replace("__FECHA__", fecha));
  console.log(`stock/index.html: ${total} disponibles`);
}
