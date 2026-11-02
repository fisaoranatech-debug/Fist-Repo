package mg.retrouve.nativemodule

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RetrouveNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw CodedException("Contexte Android indisponible")

  private val dpm: DevicePolicyManager
    get() = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  private fun adminActive() = dpm.isAdminActive(AdminReceiver.component(context))

  override fun definition() = ModuleDefinition {
    Name("RetrouveNative")

    // ----- Configuration partagée avec le code natif (SMS, alertes) -----
    Function("setAgentConfig") { apiUrl: String?, token: String?, smsSecret: String?, contactPhone: String? ->
      Prefs.get(context).edit()
        .putString("apiUrl", apiUrl)
        .putString("token", token)
        .putString("smsSecret", smsSecret)
        .putString("contactPhone", contactPhone)
        .apply()
    }

    /** Identifiants de l'appareil, sans toucher au reste de la configuration. */
    Function("setCredentials") { apiUrl: String?, token: String? ->
      val edit = Prefs.get(context).edit().putString("apiUrl", apiUrl).putString("token", token)
      if (token != null && token != Prefs.token(context)) edit.putBoolean("revoked", false).putString("state", null)
      edit.apply()
    }

    Function("setPushToken") { token: String? ->
      Prefs.get(context).edit().putString("pushToken", token).apply()
    }

    // ----- Agent natif (fonctionne application fermée) -----
    Function("startAgent") {
      Prefs.get(context).edit().putBoolean("enabled", true).apply()
      AgentService.start(context)
    }

    Function("stopAgent") {
      Prefs.get(context).edit().putBoolean("enabled", false).apply()
      AgentService.stop(context)
    }

    Function("isAgentRunning") { AgentService.running }

    Function("getAgentStatus") { AgentCore.status(context) }

    /** Synchronise tout de suite (positions, état, commandes) et renvoie l'état JSON. */
    AsyncFunction("syncNow") { forceLocate: Boolean, promise: Promise ->
      Thread {
        try {
          promise.resolve(AgentCore.sync(context, null, forceLocate))
        } catch (e: Exception) {
          promise.resolve(AgentCore.status(context))
        }
      }.start()
    }

    Function("isBackgroundRestricted") { AgentCore.isBackgroundRestricted(context) }

    // ----- Écran de blocage du mode perdu -----
    Function("canDrawOverlays") { LockOverlay.canDraw(context) }

    Function("requestOverlayPermission") {
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (appContext.currentActivity ?: context).startActivity(intent)
    }

    /** Ouvre l'écran « démarrage automatique » du fabricant (Tecno, Infinix, Xiaomi, Oppo…) si possible. */
    Function("openAutostartSettings") {
      val candidates = listOf(
        "com.transsion.phonemaster" to "com.cyin.himgr.autostart.AutoStartActivity",
        "com.transsion.phonemaster" to "com.cyin.himgr.widget.activity.MainSettingGpActivity",
        "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
        "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
        "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
        "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
        "com.hihonor.systemmanager" to "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.samsung.android.lool" to "com.samsung.android.sm.battery.ui.BatteryActivity",
      )
      val activity = appContext.currentActivity
      for ((pkg, cls) in candidates) {
        val intent = Intent().setClassName(pkg, cls).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.resolveActivity(context.packageManager) != null) {
          try {
            (activity ?: context).startActivity(intent)
            return@Function true
          } catch (_: Exception) {
          }
        }
      }
      val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        .setData(Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (activity ?: context).startActivity(details)
      false
    }

    // ----- Administrateur de l'appareil -----
    Function("isAdminActive") { adminActive() }

    Function("requestAdmin") {
      val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
        .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, AdminReceiver.component(context))
        .putExtra(
          DevicePolicyManager.EXTRA_ADD_EXPLANATION,
          "Retrouve pourra verrouiller ou effacer ce téléphone à distance en cas de vol, et vous prévenir après des mauvais codes."
        )
      val activity = appContext.currentActivity
      if (activity != null) activity.startActivity(intent)
      else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Function("lockNow") { pin: String? ->
      if (!adminActive()) throw CodedException("ADMIN_INACTIVE", "Administrateur de l'appareil non activé", null)
      var pinApplied = false
      if (!pin.isNullOrEmpty() && Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
        @Suppress("DEPRECATION")
        pinApplied = dpm.resetPassword(pin, 0)
      }
      dpm.lockNow()
      pinApplied
    }

    Function("wipe") {
      if (!adminActive()) throw CodedException("ADMIN_INACTIVE", "Administrateur de l'appareil non activé", null)
      dpm.wipeData(0)
    }

    // ----- Sonnerie -----
    Function("startAlarm") { seconds: Int -> AlarmPlayer.start(context, seconds) }
    Function("stopAlarm") { AlarmPlayer.stop(context) }
    Function("isAlarmPlaying") { AlarmPlayer.isPlaying() }

    // ----- Optimisation de la batterie -----
    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("requestIgnoreBatteryOptimizations") {
      @Suppress("BatteryLife")
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        .setData(Uri.parse("package:${context.packageName}"))
      val activity = appContext.currentActivity
      if (activity != null) activity.startActivity(intent)
      else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
