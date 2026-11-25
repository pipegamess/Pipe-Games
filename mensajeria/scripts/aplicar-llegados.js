// Aplica al catálogo (index.html) lo que llegó de importación según el Excel (stock.json → "llegados"):
//  - Si el producto ya está en el catálogo: le pone el precio de la hoja LISTADO.
//  - Si no está: lo crea con el nombre y precio de LISTADO, sin foto (queda pendiente de foto en el panel).
// Lo corre GitHub Actions cuando cambia stock.json (.github/workflows/tarifas-envio.yml).
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const ARCHIVO = path.join(RAIZ, "index.html");
let html = fs.readFileSync(ARCHIVO, "utf8");

let llegados = [], listado = [], productos = {};
try {
  const st = JSON.parse(fs.readFileSync(path.join(RAIZ, "stock.json"), "utf8"));
  llegados = st.llegados || []; listado = st.listado || []; productos = st.productos || {};
} catch {}
if (!llegados.length && !listado.length) { console.log("Sin productos llegados de importación ni de LISTADO"); process.exit(0); }

const llave = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const llavePlat = v => { const x = llave(v); return ({ SW2: "SWITCH2", NS2: "SWITCH2", SW: "SWITCH", NS: "SWITCH" })[x] || x; };
const precioTxt = n => "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const precioNum = t => Number(String(t || "").replace(/[^\d]/g, "")) || 0;

// Datos del catálogo
const NOMBRES = { ps4: "ps4", ps5: "ps5", sw: "sw", acc: "acc" };
const datos = {};
for (const n of Object.keys(NOMBRES)) {
  const m = html.match(new RegExp("^const " + n + " = (\\[.*\\]);\\s*$", "m"));
  if (!m) { console.log("No se encontró la lista " + n + " en index.html: no se cambia nada"); process.exit(0); }
  datos[n] = JSON.parse(m[1]);
}
const mMapa = html.match(/^const PG_STOCK_MAP = (\{.*\});\s*$/m);
if (!mMapa) { console.log("No se encontró PG_STOCK_MAP: no se cambia nada"); process.exit(0); }
const mapa = JSON.parse(mMapa[1]);

// Llave del Excel de cada producto del catálogo (igual que el catálogo)
function llavesDe(g) {
  const nk = g.name + "|" + g.platform;
  if (Object.prototype.hasOwnProperty.call(mapa, nk)) { const k = mapa[nk]; return Array.isArray(k) ? k : [k]; }
  return [llave(g.name) + "|" + llavePlat(g.platform)];
}
const porLlave = {};
for (const n of Object.keys(datos)) for (const g of datos[n]) for (const k of llavesDe(g)) (porLlave[k] = porLlave[k] || []).push(g);

const PLATS_JUEGO = { PS4: "ps4", PS5: "ps5", SWITCH: "sw", SWITCH2: "sw" };
function platCatalogo(pl, esAcc) {
  const p = llavePlat(pl);
  if (p === "SWITCH2") return "SWITCH 2";
  if (p === "PS4" || p === "PS5" || p === "SWITCH") return p;
  return esAcc ? "OTROS" : "OTROS";
}

let precios = 0, nuevos = 0;
// ¿Ya hay en el catálogo un producto parecido de la misma consola? (mismo juego con otro nombre)
const palabras = t => String(t || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/OPEN\s*BOX/g, " ")
  .replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(w => w && !["PS4", "PS5", "SWITCH", "SW2", "NS2", "EDITION", "EDICION", "THE", "DE", "OF"].includes(w));
const esOB = t => /OPEN\s*BOX/i.test(String(t || ""));
function parecido(nombre, plat) {
  const a = palabras(nombre), numA = a.filter(w => /^\d+$/.test(w)).sort().join(",");
  for (const n of Object.keys(datos)) for (const g of datos[n]) {
    if (g.platform !== plat || esOB(g.name) !== esOB(nombre)) continue;   // un Open Box no es el mismo producto que el nuevo
    const b = palabras(g.name), numB = b.filter(w => /^\d+$/.test(w)).sort().join(",");
    if (numA !== numB || !a.length || !b.length) continue;     // FC 26 ≠ FC 27
    const enB = a.filter(w => b.includes(w)).length / a.length, enA = b.filter(w => a.includes(w)).length / b.length;
    if (enB >= 0.75 || enA >= 0.75) return g;
  }
  return null;
}
function crear(k, nombre, pl, precio, esAcc, origen) {
  const plat = platCatalogo(pl, esAcc);
  const igual = parecido(nombre, plat);
  if (igual) { console.log(`No se crea ${nombre} (${plat}): parece ser "${igual.name}" — enlazarlo en PG_STOCK_MAP`); return; }
  const lista = (!esAcc && PLATS_JUEGO[llavePlat(pl)]) || "acc";
  const nuevo = { name: String(nombre).trim().toUpperCase(), platform: plat, price: precioTxt(precio), active: true, img: "", estreno: false };
  // Open Box: usa la foto del mismo juego nuevo (el catálogo lo marca con la cinta OPEN BOX)
  if (esOB(nombre)) { const base = parecido(String(nombre).replace(/\(?\s*OPEN\s*BOX\s*\)?/i, " "), plat); if (base && base.img) nuevo.img = base.img; }
  const arr = datos[lista];
  // se ubica después del producto de igual o menor precio de la misma consola
  let pos = -1;
  arr.forEach((g, i) => { if (g.platform === plat && precioNum(g.price) <= precio) pos = i; });
  if (pos === -1) { const prim = arr.findIndex(g => g.platform === plat); pos = prim === -1 ? arr.length - 1 : prim - 1; }
  arr.splice(pos + 1, 0, nuevo);
  const llaveNatural = llave(nuevo.name) + "|" + llavePlat(nuevo.platform);
  if (llaveNatural !== k) mapa[nuevo.name + "|" + nuevo.platform] = k;
  (porLlave[k] = porLlave[k] || []).push(nuevo);
  console.log(`Nuevo en el catálogo (${lista}, ${origen}): ${nuevo.name} (${plat}) ${nuevo.price} — pendiente de foto`);
  nuevos++;
}

// 0) Precios sincronizados entre la hoja LISTADO del Excel y el catálogo.
//    Se guarda el último precio que mandó el Excel (precios-excel.json) para saber quién cambió:
//    - Si el precio del Excel cambió desde la última vez → el catálogo toma el precio del Excel.
//    - Si el Excel no cambió pero el catálogo tiene otro precio → se cambió en el catálogo (panel Admin):
//      se respeta y queda en stock/precios-pendientes.csv para que la macro del Excel lo copie a LISTADO.
const SNAP = path.join(RAIZ, "mensajeria", "precios-excel.json");
let previos = null;
try { previos = JSON.parse(fs.readFileSync(SNAP, "utf8")); } catch {}
const deLlegados = new Set(llegados.map(r => r[0]));
// Productos en los que, desde el Excel, decidiste que manda el precio del Excel (macro: botón NO)
let forzar = new Set();
try { forzar = new Set(JSON.parse(fs.readFileSync(path.join(RAIZ, "stock.json"), "utf8")).forzar || []); } catch {}
const excel = {};
for (const [k, , , precio] of listado) if (k && precio > 0) excel[k] = Math.round(precio);
for (const [k, , , precio] of llegados) if (k && precio > 0 && !(k in excel)) excel[k] = Math.round(precio);
const pendientes = [];
for (const [k, pExcel] of Object.entries(excel)) {
  const enCatalogo = porLlave[k];
  if (!enCatalogo || !enCatalogo.length) continue;
  const antes = previos ? previos[k] : undefined;
  const cambioExcel = forzar.has(k) || (previos ? (antes !== pExcel) : false);          // primera vez: solo se toma la foto del Excel
  for (const g of enCatalogo) {
    const pCat = precioNum(g.price);
    if (pCat === pExcel) continue;
    if (cambioExcel || (deLlegados.has(k) && antes === undefined)) {
      console.log(`Precio desde el Excel ${g.name} (${g.platform}): ${g.price} → ${precioTxt(pExcel)}`);
      g.price = precioTxt(pExcel); precios++;
    } else pendientes.push([k, pCat, pExcel, g.name + " (" + g.platform + ")"]);
  }
}
fs.writeFileSync(SNAP, JSON.stringify(excel, null, 0) + "\n");
{
  const csvq = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const vistos = new Set();
  const filas = pendientes.filter(r => !vistos.has(r[0]) && vistos.add(r[0]));
  const salida = "Clave,PrecioCatalogo,PrecioExcel,Producto\n" + filas.map(r => r.map(csvq).join(",")).join("\n") + (filas.length ? "\n" : "");
  fs.mkdirSync(path.join(RAIZ, "stock"), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, "stock", "precios-pendientes.csv"), salida);
  console.log(`Precios cambiados en el catálogo, pendientes de pasar al Excel: ${filas.length}`);
}

// 1) Lo que llegó de importación y no está en el catálogo: se crea con el precio de LISTADO
for (const [k, nombre, pl, precio, esAcc] of llegados) {
  if (!k || !(precio > 0)) continue;
  const enCatalogo = porLlave[k];
  if (enCatalogo && enCatalogo.length) continue;
  crear(k, nombre, pl, precio, esAcc, "importación");
}

// 2) Cualquier producto de LISTADO con precio y unidades que no esté en el catálogo (solo PS4, PS5, Switch y Switch 2)
for (const [k, nombre, pl, precio, esAcc] of listado) {
  if (!k || !(precio > 0) || porLlave[k]) continue;
  if (!PLATS_JUEGO[llavePlat(pl)]) continue;          // gorras, convertidores, etc.: no se crean solos
  if (!(productos[k] > 0)) continue;                  // sin unidades disponibles
  crear(k, nombre, pl, precio, esAcc, "LISTADO");
}

if (!precios && !nuevos) { console.log("El catálogo ya tiene los precios y productos de LISTADO"); process.exit(0); }
for (const n of Object.keys(datos)) {
  html = html.replace(new RegExp("^const " + n + " = \\[.*\\];[ \\t]*$", "m"), () => "const " + n + " = " + JSON.stringify(datos[n]) + ";");
}
html = html.replace(/^const PG_STOCK_MAP = \{.*\};[ \t]*$/m, () => "const PG_STOCK_MAP = " + JSON.stringify(mapa) + ";");
// nueva versión: los navegadores (incluido el panel) dejan de usar la copia guardada
html = html.replace(/var VERSION = '[^']*'/, () => "var VERSION = '2025-export-" + Date.now() + "'");
fs.writeFileSync(ARCHIVO, html);
console.log(`Listo: ${precios} precio(s) actualizado(s), ${nuevos} producto(s) nuevo(s)`);
