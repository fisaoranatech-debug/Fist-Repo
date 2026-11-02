package mg.retrouve.nativemodule

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
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
