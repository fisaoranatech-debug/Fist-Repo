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

/** Envois directs au serveur depuis le code natif (quand l'app JavaScript ne tourne pas). */
internal object ApiClient {
  private fun iso(time: Long): String {
    val f = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    f.timeZone = TimeZone.getTimeZone("UTC")
    return f.format(Date(time))
  }

  private fun post(context: Context, path: String, body: JSONObject): Boolean {
    val base = Prefs.apiUrl(context) ?: return false
    val token = Prefs.token(context) ?: return false
    return try {
      val conn = java.net.URI(base.trimEnd('/') + path).toURL().openConnection() as HttpURLConnection
      conn.requestMethod = "POST"
      conn.connectTimeout = 10_000
      conn.readTimeout = 10_000
      conn.doOutput = true
      conn.setRequestProperty("Content-Type", "application/json")
      conn.setRequestProperty("Authorization", "Bearer $token")
      conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
      val ok = conn.responseCode in 200..299
      conn.disconnect()
      ok
    } catch (_: Exception) {
      false
    }
  }

  private fun battery(context: Context): Int? {
    val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager ?: return null
    val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    return if (level in 0..100) level else null
  }

  fun sendLocation(context: Context, loc: Location, source: String) {
    val point = JSONObject()
      .put("lat", loc.latitude)
      .put("lng", loc.longitude)
      .put("source", source)
      .put("recordedAt", iso(loc.time))
    if (loc.hasAccuracy()) point.put("accuracy", loc.accuracy.toDouble())
    battery(context)?.let { point.put("battery", it) }
    post(context, "/api/agent/locations", JSONObject().put("points", JSONArray().put(point)))
  }

  fun sendAlert(context: Context, type: String, data: JSONObject) {
    post(context, "/api/agent/alerts", JSONObject().put("type", type).put("data", data))
  }
}
