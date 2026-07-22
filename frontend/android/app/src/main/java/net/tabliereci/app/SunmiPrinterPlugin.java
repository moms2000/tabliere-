package net.tabliereci.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import woyou.aidlservice.jiuiv5.IWoyouService;

/**
 * Pont vers l'imprimante thermique integree des terminaux Sunmi (V2, V2 Pro...).
 * Utilise l'interface officielle Sunmi IWoyouService (service woyou.aidlservice.jiuiv5).
 * Expose printReceipt() et isAvailable() au code web.
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {

    private IWoyouService woyouService = null;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            woyouService = IWoyouService.Stub.asInterface(service);
        }
        @Override
        public void onServiceDisconnected(ComponentName name) {
            woyouService = null;
        }
    };

    @Override
    public void load() {
        bindPrinterService();
    }

    private void bindPrinterService() {
        try {
            Context ctx = getContext().getApplicationContext();
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");
            ctx.bindService(intent, connection, Context.BIND_AUTO_CREATE);
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        if (woyouService == null) bindPrinterService();
        JSObject ret = new JSObject();
        ret.put("available", woyouService != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        if (woyouService == null) {
            bindPrinterService();
            call.reject("PRINTER_NOT_READY");
            return;
        }
        try {
            IWoyouService p = woyouService;
            p.printerInit(null);

            String resto = call.getString("restoName", "");
            String table = call.getString("tableLabel", "");
            String dateText = call.getString("dateText", "");
            String footer = call.getString("footer", "");
            String totalText = call.getString("totalText", "");
            String divider = "--------------------------------\n";

            // En-tete
            p.setAlignment(1, null);
            if (resto != null && !resto.isEmpty()) {
                p.printTextWithFont(resto + "\n", "", 34f, null);
            }
            p.printTextWithFont("TablièreCI\n", "", 20f, null);
            p.setFontSize(24f, null);
            p.printText(divider, null);

            if (table != null && !table.isEmpty()) {
                p.setAlignment(1, null);
                p.printTextWithFont("Table : " + table + "\n", "", 28f, null);
            }
            if (dateText != null && !dateText.isEmpty()) {
                p.setAlignment(1, null);
                p.printTextWithFont(dateText + "\n", "", 20f, null);
            }
            p.printText(divider, null);

            // Articles (nom a gauche, prix a droite)
            p.setAlignment(0, null);
            JSArray items = call.getArray("items", new JSArray());
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject it = items.getJSONObject(i);
                    String left = it.optString("left", "");
                    String right = it.optString("right", "");
                    p.printColumnsString(
                        new String[]{ left, right },
                        new int[]{ 20, 12 },
                        new int[]{ 0, 2 },
                        null
                    );
                }
            }
            p.printText(divider, null);

            // Total
            p.printColumnsString(
                new String[]{ "TOTAL", totalText == null ? "" : totalText },
                new int[]{ 18, 14 },
                new int[]{ 0, 2 },
                null
            );
            p.printText(divider, null);

            // Pied
            if (footer != null && !footer.isEmpty()) {
                p.setAlignment(1, null);
                p.printText(footer + "\n", null);
            }

            // Avance le papier pour pouvoir dechirer (le V2 Pro n'a pas de massicot)
            p.lineWrap(4, null);

            call.resolve();
        } catch (RemoteException e) {
            call.reject("PRINT_FAILED: " + e.getMessage());
        } catch (Exception e) {
            call.reject("PRINT_ERROR: " + e.getMessage());
        }
    }
}
