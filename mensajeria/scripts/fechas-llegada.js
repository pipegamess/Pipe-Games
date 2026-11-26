// Guarda la fecha en que cada producto llegó (o subió de unidades) según stock.json → stock/llegadas.json
// Sirve para que Mati no confunda mercancía recién llegada con "stock quieto".
// Uso: node mensajeria/scripts/fechas-llegada.js [stock.json] [fecha YYYY-MM-DD]
const fs = require("fs");
const RUTA = "stock/llegadas.json";
function actualizar(prev, productos, fecha) {
  const out = { ...prev };
  for (const [k, q0] of Object.entries(productos || {})) {
    const q = Number(q0) || 0, antes = out[k];
    const qAntes = antes ? Math.max(0, antes.q) : 0;
    if (q > qAntes) out[k] = { q, d: fecha };          // llegó o subieron las unidades
    else if (antes) out[k] = { q, d: antes.d };        // se vendió o quedó igual: se conserva la fecha
    else out[k] = { q, d: null };                      // sin fecha conocida
  }
  return out;
}
module.exports = { actualizar };
if (require.main === module) {
  const stock = JSON.parse(fs.readFileSync(process.argv[2] || "stock.json", "utf8"));
  const fecha = process.argv[3] || new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const prev = fs.existsSync(RUTA) ? JSON.parse(fs.readFileSync(RUTA, "utf8")) : {};
  const nuevo = actualizar(prev, stock.productos, fecha);
  fs.mkdirSync("stock", { recursive: true });
  fs.writeFileSync(RUTA, JSON.stringify(nuevo));
  console.log("llegadas.json:", Object.keys(nuevo).length, "productos");
}
