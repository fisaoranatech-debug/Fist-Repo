package mg.retrouve.nativemodule

import android.content.Context
import android.content.SharedPreferences

/** Configuration partagée avec la partie JavaScript (serveur, jeton, code SMS). */
internal object Prefs {
  private const val NAME = "retrouve_native"

  fun get(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun apiUrl(context: Context): String? = get(context).getString("apiUrl", null)
  fun token(context: Context): String? = get(context).getString("token", null)
  fun smsSecret(context: Context): String? = get(context).getString("smsSecret", null)
  fun contactPhone(context: Context): String? = get(context).getString("contactPhone", null)
  fun failedThreshold(context: Context): Int = get(context).getInt("failedThreshold", 2)
}
