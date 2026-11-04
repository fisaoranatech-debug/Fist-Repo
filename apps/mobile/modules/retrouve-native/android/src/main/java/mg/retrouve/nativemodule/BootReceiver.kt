package mg.retrouve.nativemodule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Relance la protection après un redémarrage du téléphone ou une mise à jour de l'application. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      "android.intent.action.QUICKBOOT_POWERON",
      "com.htc.intent.action.QUICKBOOT_POWERON" -> {
        if (Prefs.enabled(context) && Prefs.token(context) != null) AgentService.start(context)
      }
    }
  }
}
