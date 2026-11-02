package mg.retrouve.nativemodule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Commandes par SMS, utiles quand le téléphone perdu n'a pas internet :
 *   LOCATE <code>  (ou LOCALISER <code>) → répond avec un lien vers la position
 *   RING <code>    (ou SONNER <code>)    → fait sonner le téléphone 60 secondes
 * Le code secret se règle sur le site, dans la fiche de l'appareil.
 */
class SmsReceiver : BroadcastReceiver() {
  private val pattern = Regex("""^\s*(LOCATE|LOCALISER|RING|SONNER)\s+(\S+)\s*$""", RegexOption.IGNORE_CASE)

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val secret = Prefs.smsSecret(context)
    if (secret.isNullOrBlank()) return
    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    if (messages.isEmpty()) return
    val sender = messages[0].originatingAddress ?: return
    val body = messages.joinToString("") { it.messageBody ?: "" }
    val match = pattern.matchEntire(body) ?: return
    val (command, code) = match.destructured
    if (code != secret) return

    val pending = goAsync()
    when (command.uppercase(Locale.ROOT)) {
      "RING", "SONNER" -> {
        try {
          AlarmPlayer.start(context, 60)
          reply(context, sender, "Retrouve : le téléphone sonne pendant 60 secondes.")
        } finally {
          pending.finish()
        }
      }
      else -> {
        LocationHelper.current(context, 20_000) { loc ->
          thread {
            try {
              val text = if (loc == null) {
                "Retrouve : position indisponible (localisation désactivée ?)."
              } else {
                val time = SimpleDateFormat("dd/MM HH:mm", Locale.FRANCE).format(Date(loc.time))
                val acc = if (loc.hasAccuracy()) " ±${loc.accuracy.toInt()} m" else ""
                ApiClient.sendLocation(context, loc, "SMS")
                "Retrouve : position du $time$acc ${LocationHelper.mapLink(loc)}"
              }
              reply(context, sender, text)
            } finally {
              pending.finish()
            }
          }
        }
      }
    }
  }

  private fun reply(context: Context, to: String, text: String) {
    try {
      val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(SmsManager::class.java)
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }
      sms.sendMultipartTextMessage(to, null, sms.divideMessage(text), null, null)
    } catch (_: Exception) {
      // Permission SEND_SMS refusée ou pas de réseau : on ne peut rien faire de plus.
    }
  }
}
