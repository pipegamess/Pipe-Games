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
