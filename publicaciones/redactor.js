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
export function promptPublicacion(d) {
  const hoy = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  return `Eres el redactor de PIPE GAMES, tienda de videojuegos en Bogotá, Colombia. Escribe en español neutro (nada de voseo argentino).

Producto:
- Juego (como lo escribió el vendedor): ${d.juego}
- Versión: ${d.version || "ESTANDAR"}
- Consola: ${d.consola}
- Estado: ${d.estado || "NUEVO Y SELLADO"}
- Disponibilidad: ${DISPO[d.dispo] || DISPO.inmediata}
- Precio: ${d.precio || "sin precio"}
- Notas del vendedor: ${d.notas || "ninguna"}
- Fecha de hoy: ${hoy}

Devuelve SOLO un objeto JSON con estas claves:
{"nombre_oficial": "nombre oficial del juego en MAYÚSCULAS, sin la consola ni la versión",
 "genero": "género principal en 1 a 3 palabras, en español",
 "fecha_lanzamiento": "fecha de lanzamiento original en la consola indicada, formato '26 de enero de 2024'; cadena vacía si no estás seguro",
 "descripcion": "texto para Mercado Libre/Falabella",
 "instagram": "cuerpo del texto para Instagram (ver reglas)"}

Reglas para "descripcion": 2 o 3 párrafos de prosa (90 a 160 palabras en total) sobre de qué trata el juego y qué ofrece (modos, jugabilidad, contenido). Sin emojis, sin HTML, sin viñetas, sin precios, sin datos de contacto, sin enlaces y sin mencionar el nombre de la tienda (Pipe Games) ni otras tiendas o canales. No repitas el encabezado (nombre, consola, estado, género, fecha): eso ya lo pone la app.

Reglas para "instagram": la app ya pone la primera línea (nombre, consola, estado y precio) y el cierre con contacto y pagos; tú escribes SOLO el cuerpo, con esta estructura exacta:
1. Una línea gancho entre signos de exclamación que termina con 2 emojis.
2. En la línea siguiente (sin línea en blanco), una línea que empieza con 📦 (pegado al texto) y termina con 2 emojis.
3. Línea en blanco y luego 3 párrafos separados por línea en blanco. Cada párrafo empieza con un emoji temático y un espacio, tiene 1 a 3 oraciones con datos concretos del juego (historia y personajes, mundo o modos, jugabilidad y contenido) y termina con 2 emojis.
4. Justo debajo del último párrafo (sin línea en blanco), una línea "Para ..." que dice para quién es el juego y termina con 2 emojis.
No pongas precio, nombre de la consola al inicio, teléfono, pagos, envíos ni hashtags. Si la disponibilidad es preventa o en camino, dilo en la línea 📦.
Ejemplo de cuerpo (para Assassin's Creed Origins):
¡Viaja al Antiguo Egipto y descubre el origen de la Hermandad de los Asesinos! 🏜️🔥
📦Un título que cambió la saga con una propuesta de rol y mundo abierto. 😤🎮

🦅 Encarna a Bayek de Siwa, un Medjay, guardián y protector de su pueblo, que emprende un viaje de venganza en los últimos años de la dinastía ptolemaica. En su camino se cruzará con figuras históricas como Cleopatra y Julio César. 👑⚔️

🗺️ Uno de los mapas más grandes y variados de la saga: el río Nilo, desiertos, ciudades como Alejandría y Menfis, pirámides, templos y tumbas para explorar a tu ritmo. Cuentas con Senu, tu águila compañera, para reconocer el terreno desde el aire y marcar enemigos y objetivos. 🏛️🌅

⚔️ Combate renovado con armas, escudos y arcos, y un sistema de progresión por niveles, equipo y habilidades. Misiones principales y secundarias, cacería y exploración libre en una ambientación histórica muy cuidada. 🏹🎯
Para los fanáticos de la saga, para los amantes de la historia y para quienes disfrutan los mundos abiertos. 🙌🐪

Para ambos: no uses la palabra "ninja". Si el juego salió hace más de 3 meses respecto a la fecha de hoy, no lo presentes como lanzamiento ni novedad. No inventes datos: si no conoces bien el juego, describe con lo que es seguro y deja "fecha_lanzamiento" vacía. Si las notas del vendedor aportan algo (por ejemplo un código de bonus), inclúyelo en ambos textos.`;
}
