# Mensajería Prueba

Plataforma de mensajería de Pipe Games: guías con número, rastreo en vivo y app Android para mensajeros. Vive en esta carpeta y no toca el catálogo.

| Parte | Dirección | Archivo |
| --- | --- | --- |
| Panel de despacho | https://pipegames.com.co/mensajeria/ | `mensajeria/index.html` |
| Rastreo para clientes | https://pipegames.com.co/mensajeria/rastreo.html | `mensajeria/rastreo.html` |
| App del mensajero (Android) | Releases del repositorio (`mensajeria-prueba.apk`) | `mensajeria/app/` |
| Reglas de seguridad | Firebase > Firestore > Reglas | `mensajeria/firestore.rules` |

Cada cambio en `mensajeria/app/` (o en config.js, comun.js, estilos.css) compila un APK nuevo en la pestaña Actions y lo publica en Releases.
