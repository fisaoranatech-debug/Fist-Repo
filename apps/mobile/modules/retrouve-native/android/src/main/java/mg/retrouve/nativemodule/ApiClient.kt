package mg.retrouve.nativemodule

import android.content.Context
import android.location.Location
import android.os.BatteryManager
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Erreur HTTP renvoyée par le serveur Retrouve. */
internal class ApiException(val status: Int, message: String) : Exception(message)

/** Appels au serveur depuis le code natif (fonctionne même quand l'interface est fermée). */
internal object ApiClient {
  fun iso(time: Long): String {
    val f = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    f.timeZone = TimeZone.getTimeZone("UTC")
    return f.format(Date(time))
  }

  /** Requête authentifiée par le jeton de l'appareil. À appeler hors du thread principal. */
  fun request(context: Context, method: String, path: String, body: JSONObject? = null): String {
    val base = Prefs.apiUrl(context) ?: throw ApiException(0, "Serveur non configuré")
    val token = Prefs.token(context) ?: throw ApiException(401, "Appareil non associé")
    val conn = java.net.URI(base.trimEnd('/') + path).toURL().openConnection() as HttpURLConnection
    try {
      conn.requestMethod = method
      conn.connectTimeout = 15_000
      conn.readTimeout = 20_000
      conn.setRequestProperty("Accept", "application/json")
      conn.setRequestProperty("Authorization", "Bearer $token")
      if (body != null) {
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
      }
      val code = conn.responseCode
      val stream = if (code in 200..299) conn.inputStream else conn.errorStream
      val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
      if (code !in 200..299) {
        val msg = try { JSONObject(text).optString("error", "Erreur $code") } catch (_: Exception) { "Erreur $code" }
        throw ApiException(code, msg)
      }
      return text
    } finally {
      conn.disconnect()
    }
  }

  fun battery(context: Context): Pair<Int?, Boolean?> {
    val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager ?: return Pair(null, null)
    val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    return Pair(if (level in 0..100) level else null, bm.isCharging)
  }

  fun point(context: Context, loc: Location, source: String): JSONObject {
    val p = JSONObject()
      .put("lat", loc.latitude)
      .put("lng", loc.longitude)
      .put("source", source)
      .put("recordedAt", iso(loc.time))
    if (loc.hasAccuracy()) p.put("accuracy", loc.accuracy.toDouble())
    if (loc.hasAltitude()) p.put("altitude", loc.altitude)
    if (loc.hasSpeed() && loc.speed >= 0) p.put("speed", loc.speed.toDouble())
    battery(context).first?.let { p.put("battery", it) }
    return p
  }

  /** Envoie une position ; en cas d'échec réseau, elle est gardée et renvoyée plus tard. */
  fun sendLocation(context: Context, loc: Location, source: String) {
    val src = if (source == "GPS") LocationHelper.sourceOf(loc) else source
    AgentCore.enqueue(context, point(context, loc, src))
    AgentCore.flushQueue(context)
  }

  fun sendAlert(context: Context, type: String, data: JSONObject) {
    try {
      request(context, "POST", "/api/agent/alerts", JSONObject().put("type", type).put("data", data))
    } catch (_: Exception) {
    }
  }

  fun sendPoints(context: Context, points: JSONArray) {
    request(context, "POST", "/api/agent/locations", JSONObject().put("points", points))
  }
}
