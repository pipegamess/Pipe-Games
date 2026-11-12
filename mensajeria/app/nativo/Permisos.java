package co.mensajeriaprueba.mensajero;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Revisa y pide, desde la app, todo lo que necesita la ubicación del mensajero:
 * ubicación precisa, ubicación todo el tiempo, notificaciones, cámara, GPS encendido,
 * batería sin restricciones e inicio automático (Xiaomi, Tecno/Infinix, Oppo, Vivo, Huawei...).
 */
@CapacitorPlugin(
    name = "Permisos",
    permissions = {
        @Permission(alias = "ubicacion", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "fondo", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = "notificaciones", strings = { Manifest.permission.POST_NOTIFICATIONS }),
        @Permission(alias = "camara", strings = { Manifest.permission.CAMERA })
    }
)
public class Permisos extends Plugin {

    private boolean tiene(String p) {
        return getContext().checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
    }

    // Pantallas de "inicio automático" de cada marca (la primera que exista)
    private static final String[][] INICIO_AUTO = {
        { "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity" },
        { "com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity" },
        { "com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity" },
        { "com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity" },
        { "com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity" },
        { "com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity" },
        { "com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity" },
        { "com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
        { "com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity" },
        { "com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
        { "com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity" },
        { "com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity" }
    };

    private Intent intentInicioAuto() {
        PackageManager pm = getContext().getPackageManager();
        for (String[] c : INICIO_AUTO) {
            Intent i = new Intent();
            i.setComponent(new ComponentName(c[0], c[1]));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                if (pm.resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY) != null) return i;
            } catch (Exception ignored) { }
        }
        return null;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        boolean fina = tiene(Manifest.permission.ACCESS_FINE_LOCATION);
        boolean gruesa = tiene(Manifest.permission.ACCESS_COARSE_LOCATION);
        JSObject r = new JSObject();
        r.put("ubicacion", fina || gruesa);
        r.put("precisa", fina);
        r.put("fondo", Build.VERSION.SDK_INT < 29 ? (fina || gruesa) : tiene(Manifest.permission.ACCESS_BACKGROUND_LOCATION));
        r.put("notificaciones", Build.VERSION.SDK_INT < 33 || tiene(Manifest.permission.POST_NOTIFICATIONS));
        r.put("camara", tiene(Manifest.permission.CAMERA));
        boolean bateria = true;
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null) bateria = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        } catch (Exception ignored) { }
        r.put("bateria", bateria);
        boolean gps = true;
        try {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        } catch (Exception ignored) { }
        r.put("gps", gps);
        r.put("inicioAuto", intentInicioAuto() != null);
        r.put("marca", Build.MANUFACTURER);
        r.put("modelo", Build.MODEL);
        r.put("android", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void pedir(PluginCall call) {
        String alias = call.getString("permiso", "");
        if (("notificaciones".equals(alias) && Build.VERSION.SDK_INT < 33) || ("fondo".equals(alias) && Build.VERSION.SDK_INT < 29)) {
            call.resolve(resultado(true));
            return;
        }
        if (getPermissionState(alias) == PermissionState.GRANTED) {
            call.resolve(resultado(true));
            return;
        }
        requestPermissionForAlias(alias, call, "despuesDePedir");
    }

    @PermissionCallback
    private void despuesDePedir(PluginCall call) {
        call.resolve(resultado(getPermissionState(call.getString("permiso", "")) == PermissionState.GRANTED));
    }

    private JSObject resultado(boolean ok) {
        JSObject r = new JSObject();
        r.put("concedido", ok);
        return r;
    }

    private boolean abrir(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void pedirBateria(PluginCall call) {
        boolean ok = abrir(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName())));
        if (!ok) ok = abrir(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        JSObject r = new JSObject();
        r.put("abierto", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void abrirInicioAuto(PluginCall call) {
        Intent i = intentInicioAuto();
        JSObject r = new JSObject();
        r.put("abierto", i != null && abrir(i));
        call.resolve(r);
    }

    @PluginMethod
    public void abrirAjustes(PluginCall call) {
        JSObject r = new JSObject();
        r.put("abierto", abrir(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()))));
        call.resolve(r);
    }

    @PluginMethod
    public void abrirGps(PluginCall call) {
        JSObject r = new JSObject();
        r.put("abierto", abrir(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)));
        call.resolve(r);
    }
}
