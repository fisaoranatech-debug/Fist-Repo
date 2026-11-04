package mg.retrouve.nativemodule

import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.security.MessageDigest
import kotlin.concurrent.thread

/** Logique commune de l'écran de blocage (fenêtre par-dessus les applis et écran sur le verrouillage). */
internal object LostUnlock {
  fun sha256(text: String): String =
    MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }

  /** Le mode perdu bloquant est-il actif ? */
  fun active(context: Context): Boolean {
    val prefs = Prefs.get(context)
    val hash = prefs.getString("lockHash", null) ?: return false
    return prefs.getBoolean("lostMode", false) && hash != prefs.getString("unlockedFor", null)
  }

  /** Vérifie le code. Bon code : fin du mode perdu (téléphone + site). */
  fun tryCode(context: Context, code: String): Boolean {
    val ctx = context.applicationContext
    val prefs = Prefs.get(ctx)
    val hash = prefs.getString("lockHash", null) ?: return true
    val deviceId = prefs.getString("deviceId", "") ?: ""
    if (code.length != 6 || sha256("$deviceId:$code") != hash) return false
    prefs.edit().putString("unlockedFor", hash).putBoolean("lostMode", false).putInt("wrongAttempts", 0).apply()
    LockOverlay.hide(ctx)
    thread {
      try {
        ApiClient.request(ctx, "POST", "/api/agent/unlock", JSONObject().put("code", code))
      } catch (_: Exception) {
      }
      AgentCore.sync(ctx, null, false)
    }
    return true
  }

  /** Nombre total de mauvais codes depuis l'activation du mode perdu. */
  fun recordWrongAttempt(context: Context): Int {
    val prefs = Prefs.get(context)
    val n = prefs.getInt("wrongAttempts", 0) + 1
    prefs.edit().putInt("wrongAttempts", n).apply()
    return n
  }

  /**
   * Mauvais code : affiche l'écran Retrouve (au premier plan, même sur l'écran de verrouillage)
   * qui prend la photo et l'envoie avec la position.
   */
  fun onWrongAttempt(context: Context, source: String) {
    val attempts = recordWrongAttempt(context)
    showLostScreen(context, capture = true, attempts = attempts, source = source)
  }

  fun showLostScreen(context: Context, capture: Boolean = false, attempts: Int = 0, source: String = "") {
    val intent = Intent(context, LostActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      .putExtra("capture", capture)
      .putExtra("attempts", attempts)
      .putExtra("source", source)
    try {
      context.startActivity(intent)
    } catch (_: Exception) {
      // Démarrage refusé par Android : on envoie au moins l'alerte sans photo.
      if (capture) IntruderReporter.report(context, null, attempts, source)
    }
  }
}
