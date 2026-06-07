/**
 * Expo config plugin: Native Bank Notification Capture
 *
 * Writes three Java files into the Android project:
 *   1. BankNotificationService.java      — NotificationListenerService that intercepts bank alerts
 *   2. NotificationPermissionModule.java — React Native bridge (isNotificationAccessGranted, etc.)
 *   3. NotificationPermissionPackage.java — registers the module with React Native
 *
 * Also patches AndroidManifest.xml to declare the service with BIND_NOTIFICATION_LISTENER_SERVICE.
 * Also patches MainApplication.java to register the package.
 */

const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Java source files ────────────────────────────────────────────────────────

function getBankNotificationServiceJava(pkg) {
  return `package ${pkg};

import android.app.Notification;
import android.content.SharedPreferences;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class BankNotificationService extends NotificationListenerService {

    static final String PREFS_NAME = "finsight_pending";
    static final String KEY_QUEUE  = "pending_transactions";

    private static final String[] BANK_NAMES = {
        "access bank","zenith","gtbank","gtb","first bank","firstbank",
        "uba","fidelity","sterling","kuda","opay","palmpay","moniepoint",
        "carbon","wema","stanbic","polaris","union bank","fcmb","ecobank",
        "providus","jaiz","keystone","vfd","renmoney","fairmoney"
    };

    private static final Pattern AMOUNT_PAT = Pattern.compile(
        "[N\\u20a6]\\\\s*([\\\\d,]+(?:\\\\.\\\\d{1,2})?)|([\\\\d,]+(?:\\\\.\\\\d{1,2})?)\\\\s*(?:naira|NGN)",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern BANK_STRUCT_PAT = Pattern.compile(
        "\\\\b(acct|a/c|avail(?:able)?\\\\s*bal|new\\\\s*bal|bal[:\\\\s]|trf|ref\\\\s*no|" +
        "DR[:\\\\s]|CR[:\\\\s]|debited|credited|withdrawal)\\\\b",
        Pattern.CASE_INSENSITIVE
    );

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null) return;
            // Skip our own app's notifications
            if (sbn.getPackageName() != null &&
                sbn.getPackageName().equals(getPackageName())) return;

            Notification notif = sbn.getNotification();
            if (notif == null || notif.extras == null) return;

            String title = notif.extras.getString(Notification.EXTRA_TITLE, "");
            String body  = notif.extras.getString(Notification.EXTRA_TEXT, "");
            if (title == null) title = "";
            if (body  == null) body  = "";

            String combined = title + " " + body;
            String lower    = combined.toLowerCase(Locale.ROOT);

            // Skip finsight budget/digest notifications
            if (lower.contains("finsight") || lower.contains("budget exceeded") ||
                lower.contains("daily digest") || lower.contains("weekly digest")) return;

            if (!isBankNotification(lower)) return;

            long amount = parseAmount(combined);
            if (amount < 10) return;

            String type = parseType(lower);
            String desc = title.trim().isEmpty() ? body.trim() : title.trim();
            if (desc.length() > 60) desc = desc.substring(0, 60);

            JSONObject tx = new JSONObject();
            String id = System.currentTimeMillis() + "" + (int)(Math.random() * 99999);
            tx.put("id", id);
            tx.put("amount", amount);
            tx.put("type", type);
            tx.put("desc", desc.isEmpty() ? "Bank Transaction" : desc);
            tx.put("source", "push");
            tx.put("cat",   type.equals("credit") ? "Income" : "Transfer");
            tx.put("bank",  detectBank(lower));
            SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy", Locale.getDefault());
            tx.put("date", sdf.format(new Date()));

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String raw   = prefs.getString(KEY_QUEUE, "[]");
            JSONArray arr = new JSONArray(raw);

            // Simple dedup: skip if same amount added in last 2 minutes
            long now = System.currentTimeMillis();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject existing = arr.getJSONObject(i);
                if (existing.optLong("amount") == amount &&
                    "push".equals(existing.optString("source")) &&
                    (now - existing.optLong("_ts", 0)) < 120_000) return;
            }
            tx.put("_ts", now);

            arr.put(tx);
            prefs.edit().putString(KEY_QUEUE, arr.toString()).apply();

        } catch (Exception ignored) {}
    }

    private boolean isBankNotification(String lower) {
        for (String b : BANK_NAMES) {
            if (lower.contains(b)) return true;
        }
        return BANK_STRUCT_PAT.matcher(lower).find();
    }

    private long parseAmount(String text) {
        Matcher m = AMOUNT_PAT.matcher(text);
        if (m.find()) {
            String raw = m.group(1) != null ? m.group(1) : m.group(2);
            if (raw != null) {
                try { return (long) Double.parseDouble(raw.replace(",", "")); }
                catch (Exception ignored) {}
            }
        }
        return 0;
    }

    private String parseType(String lower) {
        boolean isCredit = lower.matches(".*\\\\b(credit(?:ed)?|received|salary|refund|deposit|inflow|lodgement|cashback)\\\\b.*")
                        || lower.contains("cr:");
        boolean isDebit  = lower.matches(".*\\\\b(debit(?:ed)?|withdraw[an]?|paid|charged|sent|transfer(?:red)?\\\\s*to|trf\\\\s*to|transfer out)\\\\b.*")
                        || lower.contains("dr:");
        return (isCredit && !isDebit) ? "credit" : "debit";
    }

    private String detectBank(String lower) {
        if (lower.contains("gtbank") || lower.contains("gtb")) return "GTBank";
        if (lower.contains("access bank"))   return "Access Bank";
        if (lower.contains("zenith"))        return "Zenith Bank";
        if (lower.contains("first bank") || lower.contains("firstbank")) return "First Bank";
        if (lower.contains("kuda"))          return "Kuda Bank";
        if (lower.contains("opay"))          return "OPay";
        if (lower.contains("palmpay"))       return "PalmPay";
        if (lower.contains("moniepoint"))    return "Moniepoint";
        if (lower.contains("uba"))           return "UBA";
        if (lower.contains("fidelity"))      return "Fidelity Bank";
        if (lower.contains("sterling"))      return "Sterling Bank";
        if (lower.contains("wema"))          return "Wema Bank";
        if (lower.contains("stanbic"))       return "Stanbic IBTC";
        if (lower.contains("fcmb"))          return "FCMB";
        if (lower.contains("ecobank"))       return "Ecobank";
        if (lower.contains("carbon"))        return "Carbon";
        return null;
    }
}
`;
}

function getNotificationPermissionModuleJava(pkg) {
  return `package ${pkg};

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.TextUtils;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class NotificationPermissionModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public NotificationPermissionModule(ReactApplicationContext ctx) {
        super(ctx);
        this.reactContext = ctx;
    }

    @Override
    public String getName() { return "NotificationPermission"; }

    @ReactMethod
    public void isNotificationAccessGranted(Promise promise) {
        try {
            String pkgName = reactContext.getPackageName();
            String flat = Settings.Secure.getString(
                reactContext.getContentResolver(),
                "enabled_notification_listeners"
            );
            boolean granted = flat != null && flat.contains(pkgName);
            promise.resolve(granted);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void openNotificationAccessSettings(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            } else {
                intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (activity != null) {
                activity.startActivity(intent);
            } else {
                reactContext.startActivity(intent);
            }
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

    @ReactMethod
    public void drainPendingTransactions(Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                BankNotificationService.PREFS_NAME, Context.MODE_PRIVATE
            );
            String raw = prefs.getString(BankNotificationService.KEY_QUEUE, "[]");
            // Clear the queue after draining
            prefs.edit().remove(BankNotificationService.KEY_QUEUE).apply();
            promise.resolve(raw);
        } catch (Exception e) {
            promise.resolve("[]");
        }
    }

    @ReactMethod
    public void setNotificationListenerEnabled(boolean enabled, Promise promise) {
        // Managed by Android system settings; this is a no-op but kept for JS API compat
        promise.resolve(null);
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

// Step 3: Patch MainApplication to register the package
const withMainApplication = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const pkg = 'com.kvic.finsightmobile';
      const pkgPath = pkg.replace(/\./g, path.sep);
      const mainAppPath = path.join(
        platformRoot, 'app', 'src', 'main', 'java', pkgPath, 'MainApplication.java'
      );

      if (!fs.existsSync(mainAppPath)) return config; // Expo hasn't generated it yet

      let src = fs.readFileSync(mainAppPath, 'utf8');

      const marker = 'new NotificationPermissionPackage()';
      if (!src.includes(marker)) {
        // Insert after the last "new ReactNativeFeatureFlagsCxxInterop()" or before the closing "]"
        // We find the packages list and insert our package
        src = src.replace(
          /return packages;\s*\}/,
          `packages.add(new NotificationPermissionPackage());\n      return packages;\n    }`
        );
        fs.writeFileSync(mainAppPath, src, 'utf8');
      }

      return config;
    },
  ]);
};

// Compose all three steps
const withNativeBankCapture = (config) => {
  config = withJavaFiles(config);
  config = withManifest(config);
  config = withMainApplication(config);
  return config;
};

module.exports = withNativeBankCapture;
