package mg.retrouve.nativemodule

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

/** Configuration et état partagés entre l'interface (JS), le service natif et les récepteurs. */
internal object Prefs {
  private const val NAME = "retrouve_native"

  fun get(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun apiUrl(context: Context): String? = get(context).getString("apiUrl", null)
  fun token(context: Context): String? = get(context).getString("token", null)
  fun smsSecret(context: Context): String? = get(context).getString("smsSecret", null)
  fun contactPhone(context: Context): String? = get(context).getString("contactPhone", null)
  fun failedThreshold(context: Context): Int = get(context).getInt("failedThreshold", 2)
  fun pushToken(context: Context): String? = get(context).getString("pushToken", null)

  /** L'utilisateur a démarré la protection (le service doit tourner). */
  fun enabled(context: Context): Boolean = get(context).getBoolean("enabled", false)
  fun intervalSec(context: Context): Int = get(context).getInt("intervalSec", 300)
  fun lostMode(context: Context): Boolean = get(context).getBoolean("lostMode", false)

  /** Commandes déjà exécutées (les 50 dernières), pour ne jamais les rejouer. */
  fun isDone(context: Context, id: String): Boolean {
    val arr = JSONArray(get(context).getString("doneCommands", "[]"))
    for (i in 0 until arr.length()) if (arr.optString(i) == id) return true
    return false
  }

  fun markDone(context: Context, id: String) {
    val arr = JSONArray(get(context).getString("doneCommands", "[]"))
    val out = JSONArray()
    val start = maxOf(0, arr.length() - 49)
    for (i in start until arr.length()) out.put(arr.optString(i))
    out.put(id)
    get(context).edit().putString("doneCommands", out.toString()).apply()
  }
}
