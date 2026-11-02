package mg.retrouve.nativemodule

import android.Manifest
import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.telephony.TelephonyManager
import org.json.JSONArray
import org.json.JSONObject

/**
 * Cœur de l'agent Android : positions, battement de cœur, commandes à distance.
 * Tout se fait en natif pour fonctionner même quand l'interface de l'application est fermée.
 */
internal object AgentCore {
  private const val LOST_CHANNEL = "retrouve_lost_native"
  private const val LOST_NOTIFICATION_ID = 4242
  private const val MAX_QUEUE = 500
  private const val RING_SECONDS = 30
  private val lock = Any()

  // ---------- File d'attente des positions (hors ligne) ----------

  fun enqueue(context: Context, point: JSONObject) {
    synchronized(lock) {
      val prefs = Prefs.get(context)
      val arr = JSONArray(prefs.getString("queue", "[]"))
      arr.put(point)
      val trimmed = JSONArray()
      val start = maxOf(0, arr.length() - MAX_QUEUE)
      for (i in start until arr.length()) trimmed.put(arr.get(i))
      prefs.edit()
        .putString("queue", trimmed.toString())
        .putLong("lastLocationAt", System.currentTimeMillis())
        .apply()
    }
  }

  fun queued(context: Context): Int = JSONArray(Prefs.get(context).getString("queue", "[]")).length()

  /** Envoie les positions en attente par lots de 200. Renvoie false si le réseau a échoué. */
  fun flushQueue(context: Context): Boolean {
    synchronized(lock) {
      val prefs = Prefs.get(context)
      var arr = JSONArray(prefs.getString("queue", "[]"))
      while (arr.length() > 0) {
        val batch = JSONArray()
        for (i in 0 until minOf(200, arr.length())) batch.put(arr.get(i))
        try {
          ApiClient.sendPoints(context, batch)
        } catch (e: ApiException) {
          // 4xx (sauf 401/408/429) : données refusées définitivement, on les abandonne.
          if (e.status in 400..499 && e.status !in listOf(401, 408, 429)) {
            // abandon du lot
          } else {
            return false
          }
        } catch (_: Exception) {
          return false
        }
        val rest = JSONArray()
        for (i in batch.length() until arr.length()) rest.put(arr.get(i))
        arr = rest
        prefs.edit().putString("queue", arr.toString()).apply()
      }
      return true
    }
  }

  // ---------- Synchronisation ----------

  /**
   * Synchronisation complète (bloquante, hors du thread principal) :
   * position éventuelle → positions en attente → battement de cœur → commandes.
   * Renvoie l'état au format JSON pour l'interface.
   */
  fun sync(context: Context, location: Location?, forceLocate: Boolean): String {
    synchronized(this) {
      val ctx = context.applicationContext
      val prefs = Prefs.get(ctx)
      if (Prefs.token(ctx) == null || Prefs.apiUrl(ctx) == null) return status(ctx)
      try {
        val (battery, charging) = ApiClient.battery(ctx)
        var loc = location
        val critical = battery != null && battery <= 5 && charging != true
        if (loc == null && (forceLocate || critical || locationDue(ctx))) {
          loc = LocationHelper.currentBlocking(ctx, 25_000)
        }
        if (loc != null) enqueue(ctx, ApiClient.point(ctx, loc, "GPS"))
        flushQueue(ctx)

        val state = JSONObject(ApiClient.request(ctx, "POST", "/api/agent/heartbeat", heartbeatBody(ctx)))
        applyState(ctx, state)
        if (state.optInt("pendingCommands", 0) > 0) runCommands(ctx)
        prefs.edit()
          .putLong("lastSyncAt", System.currentTimeMillis())
          .putBoolean("lastSyncOk", true)
          .putString("lastError", null)
          .putBoolean("revoked", false)
          .apply()
      } catch (e: ApiException) {
        if (e.status == 401) {
          // Appareil supprimé du compte ou associé sur un autre téléphone : on arrête tout.
          prefs.edit().putBoolean("revoked", true).putBoolean("enabled", false).putString("token", null).apply()
          hideLostNotification(ctx)
          AgentService.stop(ctx)
        }
        prefs.edit()
          .putLong("lastSyncAt", System.currentTimeMillis())
          .putBoolean("lastSyncOk", false)
          .putString("lastError", e.message)
          .apply()
      } catch (e: Exception) {
        prefs.edit()
          .putLong("lastSyncAt", System.currentTimeMillis())
          .putBoolean("lastSyncOk", false)
          .putString("lastError", "Pas de connexion au serveur")
          .apply()
      }
      return status(ctx)
    }
  }

  private fun locationDue(context: Context): Boolean {
    val last = Prefs.get(context).getLong("lastLocationAt", 0)
    return System.currentTimeMillis() - last >= Prefs.intervalSec(context) * 900L
  }

  private fun heartbeatBody(context: Context): JSONObject {
    val (battery, charging) = ApiClient.battery(context)
    val body = JSONObject()
    battery?.let { body.put("battery", it) }
    charging?.let { body.put("charging", it) }
    try {
      val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
      val op = tm.simOperator
      if (!op.isNullOrEmpty() && op.length >= 5) {
        body.put("mcc", op.substring(0, 3))
        body.put("mnc", op.substring(3))
        body.put("carrierName", tm.simOperatorName ?: JSONObject.NULL)
      }
    } catch (_: Exception) {
    }
    Prefs.pushToken(context)?.let { body.put("pushToken", it) }
    try {
      body.put("appVersion", context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "")
    } catch (_: Exception) {
    }
    body.put("model", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
    body.put("osVersion", "Android ${Build.VERSION.RELEASE}")
    body.put("capabilities", JSONArray(capabilities(context)))
    return body
  }

  fun capabilities(context: Context): List<String> {
    val caps = mutableListOf("ring", "lostMode", "locate", "nativeAgent")
    val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    if (dpm.isAdminActive(AdminReceiver.component(context))) caps.add("deviceAdmin")
    if (context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) caps.add("sms")
    if (isBackgroundRestricted(context)) caps.add("bgRestricted")
    return caps
  }

  fun isBackgroundRestricted(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return am.isBackgroundRestricted
  }

  private fun applyState(context: Context, state: JSONObject) {
    val prefs = Prefs.get(context)
    val previousInterval = Prefs.intervalSec(context)
    val lost = state.optBoolean("lostMode", false)
    val interval = state.optInt("intervalSec", 300)
    prefs.edit()
      .putString("state", state.toString())
      .putBoolean("lostMode", lost)
      .putInt("intervalSec", interval)
      .putString("smsSecret", state.optString("smsSecret").takeIf { it.isNotEmpty() && it != "null" })
      .putString("contactPhone", state.optString("contactPhone").takeIf { it.isNotEmpty() && it != "null" })
      .apply()
    if (lost) {
      val msg = state.optString("lostMessage").takeIf { it.isNotEmpty() && it != "null" }
        ?: "Ce téléphone a été perdu. Merci de contacter son propriétaire."
      showLostNotification(context, msg, Prefs.contactPhone(context))
    } else {
      hideLostNotification(context)
    }
    if (previousInterval != interval) AgentService.reconfigure(context)
  }

  // ---------- Commandes ----------

  private fun runCommands(context: Context) {
    val list = JSONArray(ApiClient.request(context, "GET", "/api/agent/commands"))
    for (i in 0 until list.length()) {
      val cmd = list.getJSONObject(i)
      val id = cmd.getString("id")
      val type = cmd.getString("type")
      val payload = cmd.optJSONObject("payload")
      if (Prefs.isDone(context, id)) {
        ack(context, id, "DONE", null)
        continue
      }
      ack(context, id, "ACKED", null)
      try {
        val result: String? = when (type) {
          "RING" -> {
            AlarmPlayer.start(context, RING_SECONDS)
            "Sonnerie pendant $RING_SECONDS s"
          }
          "LOCATE_NOW" -> {
            val loc = LocationHelper.currentBlocking(context, 25_000)
              ?: throw IllegalStateException("Position indisponible (localisation désactivée ?)")
            ApiClient.sendLocation(context, loc, "GPS")
            if (loc.hasAccuracy()) "Précision ±${loc.accuracy.toInt()} m" else null
          }
          "LOST_MODE_ON" -> {
            val msg = payload?.optString("message")?.takeIf { it.isNotEmpty() }
              ?: "Ce téléphone a été perdu. Merci de contacter son propriétaire."
            val phone = payload?.optString("contactPhone")?.takeIf { it.isNotEmpty() } ?: Prefs.contactPhone(context)
            Prefs.get(context).edit().putBoolean("lostMode", true).putInt("intervalSec", 60).apply()
            showLostNotification(context, msg, phone)
            AgentService.reconfigure(context)
            null
          }
          "LOST_MODE_OFF" -> {
            Prefs.get(context).edit().putBoolean("lostMode", false).putInt("intervalSec", 300).apply()
            hideLostNotification(context)
            AgentService.reconfigure(context)
            null
          }
          "LOCK" -> {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (!dpm.isAdminActive(AdminReceiver.component(context))) {
              throw IllegalStateException("Administrateur de l'appareil non activé dans Retrouve")
            }
            dpm.lockNow()
            "Écran verrouillé"
          }
          "WIPE" -> {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (!dpm.isAdminActive(AdminReceiver.component(context))) {
              throw IllegalStateException("Administrateur de l'appareil non activé dans Retrouve")
            }
            // L'appareil va être réinitialisé : on confirme AVANT d'effacer.
            Prefs.markDone(context, id)
            ack(context, id, "DONE", "Effacement lancé")
            dpm.wipeData(0)
            continue
          }
          else -> throw IllegalStateException("Commande inconnue : $type")
        }
        Prefs.markDone(context, id)
        ack(context, id, "DONE", result)
      } catch (e: Exception) {
        Prefs.markDone(context, id)
        ack(context, id, "FAILED", (e.message ?: e.toString()).take(480))
      }
    }
  }

  private fun ack(context: Context, id: String, status: String, result: String?) {
    try {
      val body = JSONObject().put("status", status)
      if (result != null) body.put("result", result)
      ApiClient.request(context, "POST", "/api/agent/commands/$id/ack", body)
    } catch (_: Exception) {
    }
  }

  // ---------- Notification du mode perdu (visible sur l'écran verrouillé) ----------

  private fun showLostNotification(context: Context, message: String, phone: String?) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(LOST_CHANNEL, "Mode perdu", NotificationManager.IMPORTANCE_HIGH)
      channel.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      channel.setBypassDnd(true)
      nm.createNotificationChannel(channel)
    }
    val text = if (phone.isNullOrEmpty()) message else "$message\nAppelez le $phone"
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      android.app.Notification.Builder(context, LOST_CHANNEL)
    } else {
      android.app.Notification.Builder(context).setPriority(android.app.Notification.PRIORITY_MAX)
    }
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setContentTitle("🚨 Téléphone perdu")
      .setContentText(text)
      .setStyle(android.app.Notification.BigTextStyle().bigText(text))
      .setOngoing(true)
      .setVisibility(android.app.Notification.VISIBILITY_PUBLIC)
      .setContentIntent(launchIntent(context))
      .build()
    try {
      nm.notify(LOST_NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // Notifications refusées par l'utilisateur.
    }
  }

  private fun hideLostNotification(context: Context) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.cancel(LOST_NOTIFICATION_ID)
  }

  fun launchIntent(context: Context): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  // ---------- État lisible par l'interface ----------

  fun status(context: Context): String {
    val prefs = Prefs.get(context)
    val state = prefs.getString("state", null)
    return JSONObject()
      .put("state", if (state != null) JSONObject(state) else JSONObject.NULL)
      .put("lastSyncAt", prefs.getLong("lastSyncAt", 0).takeIf { it > 0 }?.let { ApiClient.iso(it) } ?: JSONObject.NULL)
      .put("lastSyncOk", prefs.getBoolean("lastSyncOk", false))
      .put("lastError", prefs.getString("lastError", null) ?: JSONObject.NULL)
      .put("lastLocationAt", prefs.getLong("lastLocationAt", 0).takeIf { it > 0 }?.let { ApiClient.iso(it) } ?: JSONObject.NULL)
      .put("revoked", prefs.getBoolean("revoked", false))
      .put("queued", queued(context))
      .put("running", AgentService.running)
      .put("enabled", Prefs.enabled(context))
      .put("bgRestricted", isBackgroundRestricted(context))
      .toString()
  }
}
