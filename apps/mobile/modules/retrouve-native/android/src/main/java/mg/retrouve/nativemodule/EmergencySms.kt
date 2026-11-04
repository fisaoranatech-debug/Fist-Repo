package mg.retrouve.nativemodule

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * SMS d'urgence automatique (option activée sur le site) : fonctionne SANS internet.
 * - Une autre carte SIM est insérée → SMS immédiat au numéro de contact (depuis la nouvelle SIM).
 * - Mode perdu et plus d'internet depuis 10 min → SMS avec la position, au plus toutes les 30 min.
 */
internal object EmergencySms {
  private const val OFFLINE_DELAY_MS = 10 * 60_000L
  private const val LOST_SMS_EVERY_MS = 30 * 60_000L
  private const val MAX_PER_DAY = 20

  private fun granted(context: Context, permission: String) =
    context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

  /**
   * Identifiant de la carte SIM actuelle. Avec l'autorisation « téléphone », on distingue même deux
   * cartes du même opérateur ; sinon on se base sur l'opérateur. "none" = pas de carte.
   */
  @Suppress("MissingPermission")
  fun simKey(context: Context): String {
    val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    if (tm.simState != TelephonyManager.SIM_STATE_READY) return "none"
    if (granted(context, Manifest.permission.READ_PHONE_STATE)) {
      try {
        val subs = context.getSystemService(SubscriptionManager::class.java)?.activeSubscriptionInfoList
        if (!subs.isNullOrEmpty()) {
          return subs.sortedBy { it.subscriptionId }.joinToString("|") { "${it.subscriptionId}:${it.carrierName}" }
        }
      } catch (_: Exception) {
      }
    }
    return "${tm.simOperator}:${tm.simOperatorName}"
  }

  /** À appeler à chaque cycle (y compris sans réseau). */
  fun check(context: Context) {
    val prefs = Prefs.get(context)
    val current = simKey(context)
    val stored = prefs.getString("simKey", null)
    if (stored == null || current == "none") {
      if (stored == null && current != "none") prefs.edit().putString("simKey", current).apply()
    } else if (current != stored) {
      prefs.edit().putString("simKey", current).apply()
      if (prefs.getBoolean("smsAlerts", false)) {
        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        send(context, "une autre carte SIM (${tm.simOperatorName ?: "?"}) a été insérée", force = true)
      }
    }

    // Mode perdu sans internet : position par SMS.
    if (prefs.getBoolean("smsAlerts", false) && Prefs.lostMode(context)) {
      val now = System.currentTimeMillis()
      val lastOk = prefs.getLong("lastOkAt", now)
      val lastSms = prefs.getLong("lastEmergencySmsAt", 0)
      if (now - lastOk >= OFFLINE_DELAY_MS && now - lastSms >= LOST_SMS_EVERY_MS) {
        send(context, "mode perdu, pas d'internet", force = false)
      }
    }
  }

  private fun send(context: Context, reason: String, force: Boolean) {
    val prefs = Prefs.get(context)
    val to = Prefs.contactPhone(context)?.replace(Regex("[^+\\d]"), "") ?: return
    if (to.length < 6 || !granted(context, Manifest.permission.SEND_SMS)) return
    val day = SimpleDateFormat("yyyyMMdd", Locale.US).format(Date())
    val countKey = "emergencySms_$day"
    val count = prefs.getInt(countKey, 0)
    if (count >= MAX_PER_DAY && !force) return
    val now = System.currentTimeMillis()
    prefs.edit().putLong("lastEmergencySmsAt", now).putInt(countKey, count + 1).apply()

    val loc = LocationHelper.currentBlocking(context, 20_000)
    val name = try {
      org.json.JSONObject(prefs.getString("state", "{}") ?: "{}").optString("name", "Téléphone")
    } catch (_: Exception) {
      "Téléphone"
    }
    val where = if (loc != null) {
      val time = SimpleDateFormat("dd/MM HH:mm", Locale.FRANCE).format(Date(loc.time))
      val acc = if (loc.hasAccuracy()) " ±${loc.accuracy.toInt()} m" else ""
      "Position du $time$acc : ${LocationHelper.mapLink(loc)}"
    } else {
      "Position indisponible."
    }
    val text = "Retrouve - $name : $reason. $where"
    try {
      val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(SmsManager::class.java)
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }
      sms.sendMultipartTextMessage(to, null, sms.divideMessage(text), null, null)
    } catch (_: Exception) {
    }
  }
}
