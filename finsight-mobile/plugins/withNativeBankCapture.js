/**
 * Expo config plugin: Native Bank Notification Capture
 *
 * Writes three Java files into the Android project:
 *   1. BankNotificationService.java      — keeps the text of alerts from bank apps and bank SMS
 *   2. NotificationPermissionModule.java — React Native bridge (isNotificationAccessGranted, etc.)
 *   3. NotificationPermissionPackage.java — registers the module with React Native
 *
 * Also declares the service in AndroidManifest.xml and registers the package in
 * MainApplication.kt. If that can't be done the build fails, because the feature
 * would otherwise ship looking fine while doing nothing.
 *
 * Reading the alerts happens in services/bankAlertParser.js, where it's tested and
 * can be corrected in an app update. The list of bank apps is sent from there too.
 */

const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Java source files ────────────────────────────────────────────────────────

function getBankNotificationServiceJava(pkg) {
  return `package ${pkg};

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.provider.Telephony;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Collections;
import java.util.Locale;
import java.util.Set;

public class BankNotificationService extends NotificationListenerService {

    static final String PREFS_NAME   = "finsight_pending";
    static final String KEY_ALERTS   = "pending_alerts";
    static final String KEY_APPS     = "capture_apps";
    static final String KEY_SENDERS  = "capture_senders";
    static final String KEY_DISCONNECTED_AT = "disconnected_at";
    // The queue is shared with NotificationPermissionModule.
    static final Object LOCK = new Object();

    // Whether Android has this listener connected in this process right now.
    static volatile boolean connected = false;

    // Asks Android to connect the listener again. It does nothing if it's already
    // connected, so it's safe to call whenever the app opens.
    static void requestReconnect(Context context) {
        try {
            requestRebind(new ComponentName(context, BankNotificationService.class));
        } catch (Exception ignored) {}
    }

    @Override
    public void onListenerConnected() {
        connected = true;
    }

    // Android or a battery saver can disconnect the listener. Without asking to be
    // connected again, capture stays off until access is switched off and on.
    @Override
    public void onListenerDisconnected() {
        connected = false;
        try {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                .putLong(KEY_DISCONNECTED_AT, System.currentTimeMillis()).apply();
        } catch (Exception ignored) {}
        requestReconnect(this);
    }

    private static final int MAX_QUEUE = 200;
    // The same text inside this window is one notification being posted again.
    private static final long REPEAT_WINDOW_MS = 120000L;
    // Longer sender names can have suffixes, such as GTBANKPLC. Short ones must match exactly.
    private static final int MIN_PREFIX_LENGTH = 5;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null) return;
            String source = sbn.getPackageName();
            if (source == null || source.equals(getPackageName())) return;

            Notification notif = sbn.getNotification();
            if (notif == null || notif.extras == null) return;
            if ((notif.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            if ((notif.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            Set<String> apps = prefs.getStringSet(KEY_APPS, Collections.<String>emptySet());
            boolean fromBankApp = apps.contains(source);
            boolean fromSmsApp = source.equals(Telephony.Sms.getDefaultSmsPackage(this));
            // Anything else is dropped here, without its text being kept.
            if (!fromBankApp && !fromSmsApp) return;

            String title = readText(notif.extras, Notification.EXTRA_TITLE);
            if (!fromBankApp && !isBankSender(title, prefs)) return;

            String text = readText(notif.extras, Notification.EXTRA_BIG_TEXT);
            if (text.isEmpty()) text = readText(notif.extras, Notification.EXTRA_TEXT);
            if (text.isEmpty()) return;

            long postedAt = sbn.getPostTime();
            String id = Integer.toHexString((source + "|" + title + "|" + text).hashCode())
                + "_" + (postedAt / REPEAT_WINDOW_MS);

            synchronized (LOCK) {
                JSONArray queue = new JSONArray(prefs.getString(KEY_ALERTS, "[]"));
                for (int i = 0; i < queue.length(); i++) {
                    if (id.equals(queue.getJSONObject(i).optString("id"))) return;
                }
                JSONObject alert = new JSONObject();
                alert.put("id", id);
                alert.put("pkg", source);
                alert.put("channel", fromBankApp ? "app" : "sms");
                alert.put("title", title);
                alert.put("text", text);
                alert.put("postedAt", postedAt);
                queue.put(alert);
                while (queue.length() > MAX_QUEUE) queue.remove(0);
                prefs.edit().putString(KEY_ALERTS, queue.toString()).apply();
            }
        } catch (Exception ignored) {}
    }

    // getCharSequence, because many apps send styled text that getString returns as nothing.
    private String readText(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString().trim();
    }

    private boolean isBankSender(String title, SharedPreferences prefs) {
        String sender = title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        for (String known : prefs.getStringSet(KEY_SENDERS, Collections.<String>emptySet())) {
            if (sender.equals(known)) return true;
            if (known.length() >= MIN_PREFIX_LENGTH && sender.startsWith(known)) return true;
        }
        return false;
    }
}
`;
}

function getNotificationPermissionModuleJava(pkg) {
  return `package ${pkg};

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

public class NotificationPermissionModule extends ReactContextBaseJavaModule {

    private static final String KEY_OLD_QUEUE = "pending_transactions";

    private final ReactApplicationContext reactContext;

    public NotificationPermissionModule(ReactApplicationContext ctx) {
        super(ctx);
        this.reactContext = ctx;
    }

    @Override
    public String getName() { return "NotificationPermission"; }

    private SharedPreferences prefs() {
        return reactContext.getSharedPreferences(BankNotificationService.PREFS_NAME, Context.MODE_PRIVATE);
    }

    private Set<String> toSet(String json) throws Exception {
        JSONArray array = new JSONArray(json);
        Set<String> values = new HashSet<String>();
        for (int i = 0; i < array.length(); i++) values.add(array.getString(i));
        return values;
    }

    @ReactMethod
    public void isNotificationAccessGranted(Promise promise) {
        try {
            String flat = Settings.Secure.getString(
                reactContext.getContentResolver(),
                "enabled_notification_listeners"
            );
            promise.resolve(flat != null && flat.contains(reactContext.getPackageName()));
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void openNotificationAccessSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    // Android can block notification access for apps not installed from a store.
    // It's unblocked from the app's info page.
    @ReactMethod
    public void openAppInfo(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + reactContext.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void requestBatteryOptimizationExemption(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                String pkg = reactContext.getPackageName();
                PowerManager pm = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + pkg));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    reactContext.startActivity(intent);
                }
            }
            promise.resolve(null);
        } catch (Exception e) {
            promise.resolve(null);
        }
    }

    private boolean accessGranted() {
        String flat = Settings.Secure.getString(reactContext.getContentResolver(), "enabled_notification_listeners");
        return flat != null && flat.contains(reactContext.getPackageName());
    }

    private boolean batteryExempt() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(reactContext.getPackageName());
    }

    // Called whenever the app opens. Reconnects the listener if Android dropped it,
    // and reports what might stop capture so the app can say what to change.
    @ReactMethod
    public void ensureCapture(Promise promise) {
        try {
            boolean granted = accessGranted();
            boolean wasConnected = BankNotificationService.connected;
            if (granted && !wasConnected) BankNotificationService.requestReconnect(reactContext);
            WritableMap status = Arguments.createMap();
            status.putBoolean("granted", granted);
            status.putBoolean("connected", wasConnected);
            status.putBoolean("batteryExempt", batteryExempt());
            status.putDouble("disconnectedAt",
                prefs().getLong(BankNotificationService.KEY_DISCONNECTED_AT, 0L));
            promise.resolve(status);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setCaptureSources(String appsJson, String sendersJson, Promise promise) {
        try {
            prefs().edit()
                .putStringSet(BankNotificationService.KEY_APPS, toSet(appsJson))
                .putStringSet(BankNotificationService.KEY_SENDERS, toSet(sendersJson))
                // The older format guessed at amounts, so its entries aren't trusted.
                .remove(KEY_OLD_QUEUE)
                .apply();
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getPendingAlerts(Promise promise) {
        synchronized (BankNotificationService.LOCK) {
            promise.resolve(prefs().getString(BankNotificationService.KEY_ALERTS, "[]"));
        }
    }

    // Called only after the app has stored the alerts, so a failed save loses nothing.
    @ReactMethod
    public void removePendingAlerts(String idsJson, Promise promise) {
        try {
            Set<String> ids = toSet(idsJson);
            synchronized (BankNotificationService.LOCK) {
                JSONArray queue = new JSONArray(prefs().getString(BankNotificationService.KEY_ALERTS, "[]"));
                JSONArray kept = new JSONArray();
                for (int i = 0; i < queue.length(); i++) {
                    JSONObject alert = queue.getJSONObject(i);
                    if (!ids.contains(alert.optString("id"))) kept.put(alert);
                }
                prefs().edit().putString(BankNotificationService.KEY_ALERTS, kept.toString()).apply();
            }
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
`;
}

function getNotificationPermissionPackageJava(pkg) {
  return `package ${pkg};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class NotificationPermissionPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext ctx) {
        return Arrays.<NativeModule>asList(new NotificationPermissionModule(ctx));
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext ctx) {
        return Collections.emptyList();
    }
}
`;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

// Step 1: Write Java source files
const withJavaFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot; // android/
      const pkg = 'com.kvic.finsightmobile';
      const pkgPath = pkg.replace(/\./g, path.sep);
      const javaDir = path.join(platformRoot, 'app', 'src', 'main', 'java', pkgPath);

      fs.mkdirSync(javaDir, { recursive: true });

      fs.writeFileSync(
        path.join(javaDir, 'BankNotificationService.java'),
        getBankNotificationServiceJava(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(javaDir, 'NotificationPermissionModule.java'),
        getNotificationPermissionModuleJava(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(javaDir, 'NotificationPermissionPackage.java'),
        getNotificationPermissionPackageJava(pkg),
        'utf8'
      );

      return config;
    },
  ]);
};

// Step 2: Patch AndroidManifest to declare the service
const withManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return config;

    // Avoid duplicates
    const services = app.service || [];
    const svcName = '.BankNotificationService';
    const alreadyDeclared = services.some(
      (s) => s.$?.['android:name'] === svcName
    );

    if (!alreadyDeclared) {
      app.service = [
        ...services,
        {
          $: {
            'android:name': svcName,
            'android:label': 'FinSight Bank Alert Capture',
            'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: { 'android:name': 'android.service.notification.NotificationListenerService' },
                },
              ],
            },
          ],
        },
      ];
    }

    return config;
  });
};

// Step 3: Register the package in MainApplication.kt
const PACKAGE_LIST = /PackageList\(this\)\.packages\.apply \{/;
const REGISTRATION = 'add(NotificationPermissionPackage())';

const REGISTER_FAILED = 'withNativeBankCapture: could not register NotificationPermissionPackage in MainApplication.kt. Bank alert capture would not work, so update this plugin.';

function registerPackage(contents) {
  if (contents.includes(REGISTRATION)) return contents;
  if (!PACKAGE_LIST.test(contents)) throw new Error(REGISTER_FAILED);
  return contents.replace(PACKAGE_LIST, match => `${match}\n              ${REGISTRATION}`);
}

const withPackageRegistered = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const pkg = 'com.kvic.finsightmobile';
      const mainAppPath = path.join(
        config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', pkg.replace(/\./g, path.sep), 'MainApplication.kt'
      );
      if (!fs.existsSync(mainAppPath)) throw new Error(REGISTER_FAILED);
      fs.writeFileSync(mainAppPath, registerPackage(fs.readFileSync(mainAppPath, 'utf8')), 'utf8');
      return config;
    },
  ]);
};

// Compose all three steps
const withNativeBankCapture = (config) => {
  config = withJavaFiles(config);
  config = withManifest(config);
  config = withPackageRegistered(config);
  return config;
};

module.exports = withNativeBankCapture;
module.exports.registerPackage = registerPackage;
