// Redacción de publicaciones (Mercado Libre/Falabella e Instagram): la usan Publicaciones y Pipe Bot del Centro de Mando.
export const CONSOLAS = [
  { k: "PS5", nombre: "PLAYSTATION 5" },
  { k: "PS4", nombre: "PLAYSTATION 4" },
  { k: "SWITCH", nombre: "NINTENDO SWITCH" },
  { k: "SWITCH 2", nombre: "NINTENDO SWITCH 2" },
  { k: "XBOX", nombre: "XBOX SERIES X|S" }
];
export const CIERRE_BASE = () => "🕹Videojuegos, Consolas, Libros de Arte y accesorios. Compra fácil y recibe en cualquier parte del país.🕹 📍Tienda Virtual en Bogotá✌🏻 💳Pagos vía Transferencia vía Nequi o Llave Bre-B, pagos con Tarjeta de crédito (3.59%+$900), con Addi🔵 (+7.7%), con Sistecrédito🟢(+5%). 📲WhatsApp 311 8836995📱\n👉🏻Visita nuestro catálogo actualizado en pipegames.com.co👈🏻";
export const DISPO = {
  inmediata: "disponible para entrega inmediata",
  preventa: "en preventa (se reserva con abono)",
  importacion: "en camino: llega en los próximos días, se puede apartar"
};
// Tipo de artículo según el nombre: los accesorios y consolas no tienen historia ni personajes, se describen por lo que hacen
const RE_ACC = /\b(micro\s*sd|sd\s*express|tarjeta|memoria|ssd|disco|almacenamiento|control(es)?|mando|joy-?con|dualsense|dualshock|estuche|funda|maleta|base|dock|cargador|carga|cable|adaptador|aud[ií]fonos|diadema|headset|parlante|c[aá]mara|vidrio|protector|grip|volante|amiibo|figura|soporte|teclado|mouse|bater[ií]a|hdmi|ventilador|stand)\b/i;
const RE_CONSOLA = /\b(consola|console|oled|ps5\s*slim|ps5\s*pro|playstation\s*5\s*(slim|pro)|switch\s*2\s*(est[aá]ndar|bundle|pack|mario))\b/i;
export function tipoDe(nombre) {
  const n = String(nombre || "");
  if (RE_CONSOLA.test(n)) return "consola";
  if (RE_ACC.test(n)) return "accesorio";
  return "juego";
}
export function promptPublicacion(d) {
  const hoy = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const tipo = d.tipo || tipoDe(d.juego);
  const esJuego = tipo === "juego";
  const que = esJuego ? "juego" : tipo === "consola" ? "consola" : "accesorio";
  return `Eres el redactor de PIPE GAMES, tienda de videojuegos en Bogotá, Colombia. Escribe en español neutro (nada de voseo argentino).

Producto (${esJuego ? "videojuego" : tipo === "consola" ? "consola de videojuegos" : "accesorio o producto que no es un videojuego"}):
- ${esJuego ? "Juego" : "Artículo"} (como lo escribió el vendedor): ${d.juego}${d.tituloAmazon ? `
- Título del anuncio en Amazon: ${d.tituloAmazon}` : ""}
- Versión: ${d.version || "ESTANDAR"}
- Consola: ${d.consola}
- Estado: ${d.estado || "NUEVO Y SELLADO"}
- Disponibilidad: ${DISPO[d.dispo] || DISPO.inmediata}
- Precio: ${d.precio || "sin precio"}
- Notas del vendedor: ${d.notas || "ninguna"}${d.contexto ? `

Información encontrada en internet sobre este producto (tiendas, reseñas y páginas oficiales; úsala para los datos concretos, ignora lo que no corresponda a este ${que}${esJuego ? ", esta edición" : ""} o esta consola):
${d.contexto}

Con esa información:${esJuego ? `
- Si la edición incluye DLC, expansiones, pases de temporada, contenido descargable, mejoras para la consola u otro contenido adicional, dedícale un párrafo completo de la descripción con los nombres exactos de ese contenido, y menciónalo también en Instagram (por ejemplo en la línea 📦 o en un párrafo).
- Si es una "Game-Key Card" (tarjeta llave de juego: la caja trae una tarjeta que habilita la descarga, el juego no viene completo en el cartucho), dilo con claridad en la descripción: se necesita conexión a internet y espacio en la consola para descargarlo la primera vez.
- Usa los nombres oficiales de modos, regiones, personajes y mejoras que aparezcan ahí; no inventes nada que no esté en la información ni sea conocido del juego.` : `
- Usa las especificaciones exactas que aparezcan ahí (marca, modelo, capacidad, velocidades, conectividad, batería, compatibilidad, licencia oficial, contenido de la caja). No inventes especificaciones que no estén en la información ni sean conocidas del producto.
- No menciones garantías del fabricante, precios de otras tiendas ni promociones.`}` : ""}
- Fecha de hoy: ${hoy}

Devuelve SOLO un objeto JSON con estas claves:
${esJuego ? `{"nombre_oficial": "nombre oficial del juego en MAYÚSCULAS, sin la consola ni la versión",
 "genero": "género principal en 1 a 3 palabras, en español",
 "fecha_lanzamiento": "fecha de lanzamiento original en la consola indicada, formato '26 de enero de 2024'; cadena vacía si no estás seguro",` : `{"nombre_oficial": "nombre corto y claro del ${que} en MAYÚSCULAS y en español, con marca y dato clave (ej. 'TARJETA MICROSD EXPRESS SANDISK 512GB'), sin la consola",
 "genero": "${tipo === "consola" ? "cadena vacía" : "tipo de accesorio en 1 a 3 palabras, en español (ej. 'Almacenamiento', 'Control', 'Estuche')"}",
 "fecha_lanzamiento": "cadena vacía",`}
 "descripcion": "texto para Mercado Libre/Falabella",
 "instagram": "cuerpo del texto para Instagram (ver reglas)"}

${esJuego ? `Reglas para "descripcion": 4 párrafos de prosa separados por una línea en blanco, entre 220 y 320 palabras en total (nunca menos de 200: Falabella y Mercado Libre premian las descripciones completas). Párrafo 1: de qué trata el juego, su historia y personajes principales. Párrafo 2: el mundo, los escenarios o la ambientación. Párrafo 3: la jugabilidad, los modos de juego (historia, multijugador, en línea, cooperativo) y lo que hace especial al juego en esa consola. Párrafo 4: el contenido y la duración, a qué tipo de jugador le va a gustar y por qué vale la pena tenerlo en físico. Usa datos concretos y verdaderos del juego; si no estás seguro de un dato, no lo inventes.` : `Reglas para "descripcion": 4 párrafos de prosa separados por una línea en blanco, entre 180 y 300 palabras en total. Párrafo 1: qué es el ${que}, para qué sirve y con qué consola es compatible (si tiene licencia oficial, dilo). Párrafo 2: las especificaciones y el rendimiento con datos concretos (capacidad, velocidades, conectividad, batería, resolución, etc., según el producto). Párrafo 3: el diseño, la construcción, la facilidad de uso o instalación y lo que trae la caja si se conoce. Párrafo 4: a quién le sirve y por qué vale la pena tenerlo. Usa datos concretos y verdaderos; si no estás seguro de un dato, no lo pongas. Nunca hables de historia, personajes ni modos de juego.`} Sin emojis, sin HTML, sin viñetas, sin precios, sin datos de contacto, sin enlaces y sin mencionar el nombre de la tienda (Pipe Games) ni otras tiendas o canales. No repitas el encabezado (nombre, consola, estado, género, fecha): eso ya lo pone la app.

Reglas para "instagram": la app ya pone la primera línea (nombre, consola, estado y precio) y el cierre con contacto y pagos; tú escribes SOLO el cuerpo, con esta estructura exacta:
1. Una línea gancho entre signos de exclamación que termina con 2 emojis.
2. En la línea siguiente (sin línea en blanco), una línea que empieza con 📦 (pegado al texto) y termina con 2 emojis.
3. Línea en blanco y luego 3 párrafos separados por línea en blanco. Cada párrafo empieza con un emoji temático y un espacio, tiene 1 a 3 oraciones con datos concretos ${esJuego ? "del juego (historia y personajes, mundo o modos, jugabilidad y contenido)" : `del ${que} (para qué sirve y compatibilidad, especificaciones y rendimiento, diseño y uso)`} y termina con 2 emojis.
4. Justo debajo del último párrafo (sin línea en blanco), una línea "Para ..." que dice para quién es el ${que} y termina con 2 emojis.
No pongas precio, nombre de la consola al inicio, teléfono, pagos, envíos ni hashtags. Si la disponibilidad es preventa o en camino, dilo en la línea 📦.
${esJuego ? `Ejemplo de cuerpo (para Assassin's Creed Origins):
¡Viaja al Antiguo Egipto y descubre el origen de la Hermandad de los Asesinos! 🏜️🔥
📦Un título que cambió la saga con una propuesta de rol y mundo abierto. 😤🎮

🦅 Encarna a Bayek de Siwa, un Medjay, guardián y protector de su pueblo, que emprende un viaje de venganza en los últimos años de la dinastía ptolemaica. En su camino se cruzará con figuras históricas como Cleopatra y Julio César. 👑⚔️

🗺️ Uno de los mapas más grandes y variados de la saga: el río Nilo, desiertos, ciudades como Alejandría y Menfis, pirámides, templos y tumbas para explorar a tu ritmo. Cuentas con Senu, tu águila compañera, para reconocer el terreno desde el aire y marcar enemigos y objetivos. 🏛️🌅

⚔️ Combate renovado con armas, escudos y arcos, y un sistema de progresión por niveles, equipo y habilidades. Misiones principales y secundarias, cacería y exploración libre en una ambientación histórica muy cuidada. 🏹🎯
Para los fanáticos de la saga, para los amantes de la historia y para quienes disfrutan los mundos abiertos. 🙌🐪` : `Ejemplo de cuerpo (para una tarjeta microSD Express de 256GB para Switch 2):
¡Más espacio y cargas ultrarrápidas para tu Nintendo Switch 2! ⚡🎮
📦Tarjeta microSD Express de 256GB, nueva y sellada. 💾✨

🚀 La Nintendo Switch 2 solo acepta tarjetas microSD Express para ampliar su memoria, y esta te permite guardar muchos más juegos sin borrar nada. 🕹️📂

⚡ Sus altas velocidades de lectura y escritura hacen que los juegos carguen rápido y que las descargas se instalen en menos tiempo. 💨🔥

🔧 Solo la insertas en la ranura de la consola y listo; también guarda tus capturas de pantalla y videos. 📸🎯
Para los jugadores que quieren aprovechar al máximo su Switch 2 sin preocuparse por el espacio. 🙌🎮`}

Para ambos: no uses la palabra "ninja". Si el producto salió hace más de 3 meses respecto a la fecha de hoy, no lo presentes como lanzamiento ni novedad. No inventes datos: si no conoces bien el producto, describe con lo que es seguro${esJuego ? ' y deja "fecha_lanzamiento" vacía' : ""}. Si las notas del vendedor aportan algo (por ejemplo un código de bonus), inclúyelo en ambos textos.`;
}

// Lee el JSON que devuelve la IA aunque venga con defectos típicos (sobre todo el modelo gratuito de Cloudflare):
// texto antes o después, bloques ```json, saltos de línea sin escapar dentro de los textos, comas sobrantes
// o la respuesta cortada al final. Devuelve null si no hay forma de rescatarlo.
export function leerJSON(texto) {
  let t = String(texto || "").replace(/```(?:json)?/gi, "").trim();
  const i = t.indexOf("{"); if (i < 0) return null;
  t = t.slice(i);
  const intentar = s => { try { const o = JSON.parse(s); return o && typeof o === "object" ? o : null; } catch { return null; } };
  const k = t.lastIndexOf("}");
  let o = k > 0 && intentar(t.slice(0, k + 1)); if (o) return o;
  // Recorre el texto escapando lo que no puede ir crudo dentro de una cadena y cierra lo que quedó abierto
  let out = "", dentro = false, esc = false;
  for (const c of t) {
    if (dentro) {
      if (esc) { out += c; esc = false; continue; }
      if (c === "\\") { out += c; esc = true; continue; }
      if (c === '"') { dentro = false; out += c; continue; }
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") continue;
      if (c === "\t") { out += "\\t"; continue; }
      out += c;
    } else { if (c === '"') dentro = true; out += c; }
  }
  const limpio = s => s.replace(/,\s*([}\]])/g, "$1");
  const kk = out.lastIndexOf("}");
  o = kk > 0 && intentar(limpio(out.slice(0, kk + 1))); if (o) return o;
  // Respuesta cortada: se cierra la cadena y el objeto
  let cerrado = out.replace(/\\$/, "");
  if (dentro) cerrado += '"';
  cerrado = cerrado.replace(/,\s*$/, "").replace(/,\s*"[^"]*"\s*:?\s*$/, "");
  o = intentar(limpio(cerrado + "}")); if (o) return o;
  // Último recurso: sacar cada clave "x": "..." por separado
  const res = {}, re = /"([a-z_]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g; let m;
  while ((m = re.exec(out))) { try { res[m[1]] = JSON.parse('"' + m[2] + '"'); } catch { res[m[1]] = m[2]; } }
  return Object.keys(res).length ? res : null;
}
