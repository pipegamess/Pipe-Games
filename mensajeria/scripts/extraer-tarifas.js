// Copia las tarifas de envío del catálogo (../../index.html) a mensajeria/tarifas-envio.js,
// para que la página de saldo use exactamente los mismos valores y municipios.
// Lo corre GitHub Actions cada vez que cambia el catálogo (.github/workflows/tarifas-envio.yml).
const fs = require("fs");
const path = require("path");
const catalogo = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
const ini = catalogo.indexOf("const ENVIO_LOCAL_VALOR");
const fin = catalogo.indexOf("function envElegirTransp");
if (ini < 0 || fin < 0 || fin < ini) { console.error("No encontré el bloque de envíos en el catálogo"); process.exit(1); }
const bloque = catalogo.slice(ini, fin).trim();
const salida = `// GENERADO AUTOMÁTICAMENTE desde el catálogo (index.html). No editar a mano:
// los cambios se hacen en el catálogo y este archivo se actualiza solo.
${bloque}

export { ENVIO_LOCAL_VALOR, ENVIO_TARIFAS, ENVIO_TRANSP, ENVIO_MUNI, ENVIO_ALIAS, envioTransp, envNorm, envEtiqueta, envBuscar, envioDeCiudad };
`;
const destino = path.join(__dirname, "..", "tarifas-envio.js");
const antes = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : "";
if (antes !== salida) { fs.writeFileSync(destino, salida); console.log("tarifas-envio.js actualizado"); }
else console.log("tarifas-envio.js sin cambios");

// Productos del catálogo (nombre, plataforma y precio) para la calculadora de saldos de la mensajería
const productos = [];
for (const lista of ["ps4", "ps5", "sw", "acc"]) {
  const m = catalogo.match(new RegExp("^const " + lista + " = (\\[.*\\]);\\s*$", "m"));
  if (!m) { console.error("No encontré la lista de productos " + lista); continue; }
  for (const x of JSON.parse(m[1])) {
    const v = parseInt(String(x.price || "").replace(/\D/g, ""), 10) || 0;
    if (x.name && v) productos.push({ n: String(x.name).trim(), p: x.platform || lista.toUpperCase(), v, a: x.active !== false });
  }
}
const salidaP = `// GENERADO AUTOMÁTICAMENTE desde el catálogo (index.html). No editar a mano.
export const PRODUCTOS = ${JSON.stringify(productos)};
`;
const destinoP = path.join(__dirname, "..", "productos-catalogo.js");
const antesP = fs.existsSync(destinoP) ? fs.readFileSync(destinoP, "utf8") : "";
if (antesP !== salidaP) { fs.writeFileSync(destinoP, salidaP); console.log("productos-catalogo.js actualizado (" + productos.length + " productos)"); }
else console.log("productos-catalogo.js sin cambios");
