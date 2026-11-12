// Configuración del proyecto. Lo usan el panel, la página de rastreo y la app del mensajero.
export const firebaseConfig = {
  apiKey: "AIzaSyD7p7lfhVix5Td3Fj9QEftXbzGyNHTogp4",
  authDomain: "mensajeria-prueba-b9198.firebaseapp.com",
  projectId: "mensajeria-prueba-b9198",
  storageBucket: "mensajeria-prueba-b9198.firebasestorage.app",
  messagingSenderId: "1008945487177",
  appId: "1:1008945487177:web:d204c2eb931ccfd6d5ce98"
};

export const ADMIN_UID = "8xMsK91tEja5hzhBtjqDIgCP0423";

// Dirección pública de la página de rastreo (GitHub Pages).
export const URL_RASTREO = "https://pipegames.com.co/mensajeria/rastreo.html";

// Página donde se descarga la app del mensajero (último APK publicado).
export const URL_APK = "https://github.com/pipegamess/Pipe-Games/releases/latest/download/mensajeria-prueba.apk";

// Clave de TomTom (búsqueda de direcciones en el panel). Plan gratis, sin tarjeta.
export const TOMTOM_KEY = "goxwKHuXB9HkWJOOg2SieNvEGHsiAk1m";

export const NOMBRE_SERVICIO = "Mensajería Prueba";

export const FIREBASE_VERSION = "12.19.0";

// Intermediario de Skydropx (Cloudflare Worker). Las claves de Skydropx viven allá, no aquí.
export const SKYDROPX_URL = "https://skydropx-pipegames.pipe-games22.workers.dev";
