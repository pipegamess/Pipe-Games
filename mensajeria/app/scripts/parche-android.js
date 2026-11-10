// Ajustes al proyecto Android generado por Capacitor.
const fs = require("fs");
const path = require("path");
const res = path.join(__dirname, "..", "android", "app", "src", "main", "res");

// Textos e ícono de la notificación fija mientras el turno está activo.
const strings = path.join(res, "values", "strings.xml");
let s = fs.readFileSync(strings, "utf8");
if (!s.includes("capacitor_background_geolocation_notification_icon")) {
  s = s.replace("</resources>",
`    <string name="capacitor_background_geolocation_notification_channel_name">Turno activo</string>
    <string name="capacitor_background_geolocation_notification_icon">drawable/ic_tracking</string>
    <string name="capacitor_background_geolocation_notification_color">#D24A1E</string>
</resources>`);
  fs.writeFileSync(strings, s);
}

// Ícono vectorial (silueta de pin) para la notificación.
const dir = path.join(res, "drawable");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "ic_tracking.xml"),
`<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF"
      android:pathData="M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13c0,-3.87 -3.13,-7 -7,-7zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5 2.5,1.12 2.5,2.5 -1.12,2.5 -2.5,2.5z"/>
</vector>
`);

// Escáner de Google (ML Kit): descargar el módulo al instalar la app.
const manifest = path.join(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");
let mf = fs.readFileSync(manifest, "utf8");
// Cámara para el escaneo continuo de guías.
if (!mf.includes("android.permission.CAMERA")) {
  mf = mf.replace("<application", `<uses-permission android:name="android.permission.CAMERA" />
    <application`);
}
if (!mf.includes("com.google.mlkit.vision.DEPENDENCIES")) {
  mf = mf.replace("</application>", `    <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />
    </application>`);
}
fs.writeFileSync(manifest, mf);

// Versión visible de la app = número de compilación de GitHub.
const gradle = path.join(__dirname, "..", "android", "app", "build.gradle");
let g = fs.readFileSync(gradle, "utf8");
const n = parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10);
g = g.replace(/versionCode \d+/, `versionCode ${n}`).replace(/versionName "[^"]*"/, `versionName "1.0.${n}"`);
// Firma fija con la llave del repositorio, para que cada versión se instale encima de la anterior.
if (!g.includes("signingConfigs {")) {
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        debug {
            storeFile file("../../debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }`);
}
fs.writeFileSync(gradle, g);
console.log("Parche Android aplicado, versión 1.0." + n);
