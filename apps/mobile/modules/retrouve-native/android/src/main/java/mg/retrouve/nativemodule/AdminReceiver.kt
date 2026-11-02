package mg.retrouve.nativemodule

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.UserHandle
import org.json.JSONObject
import kotlin.concurrent.thread

/**
 * Récepteur « administrateur de l'appareil ».
 * Après plusieurs mauvais codes de déverrouillage, envoie une alerte avec la position.
 */
class AdminReceiver : DeviceAdminReceiver() {
  companion object {
    fun component(context: Context) = ComponentName(context.applicationContext, AdminReceiver::class.java)
  }

  override fun onPasswordFailed(context: Context, intent: Intent, user: UserHandle) {
    val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val attempts = try {
      dpm.currentFailedPasswordAttempts
    } catch (_: SecurityException) {
      0
    }
    if (attempts < Prefs.failedThreshold(context)) return
    val pending = goAsync()
    LocationHelper.current(context, 15_000) { loc ->
      thread {
        try {
          val data = JSONObject().put("failedAttempts", attempts)
          if (loc != null) {
            data.put("lat", loc.latitude).put("lng", loc.longitude)
            ApiClient.sendLocation(context, loc, "GPS")
          }
          ApiClient.sendAlert(context, "FAILED_UNLOCK", data)
        } finally {
          pending.finish()
        }
      }
    }
  }

  override fun onPasswordSucceeded(context: Context, intent: Intent, user: UserHandle) {
    // Rien à faire : le compteur du système est remis à zéro automatiquement.
  }

  override fun onDisableRequested(context: Context, intent: Intent): CharSequence =
    "Si vous désactivez Retrouve, ce téléphone ne pourra plus être verrouillé ni effacé à distance en cas de vol."
}
