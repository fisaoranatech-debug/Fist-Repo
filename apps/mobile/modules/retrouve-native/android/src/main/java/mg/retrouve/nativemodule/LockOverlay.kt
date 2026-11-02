package mg.retrouve.nativemodule

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputFilter
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.security.MessageDigest
import kotlin.concurrent.thread

/**
 * Écran de blocage du mode perdu : couvre tout l'écran, par-dessus toutes les applications,
 * et ne disparaît qu'avec le code de déblocage affiché sur le site Retrouve.
 * Nécessite l'autorisation « Afficher par-dessus d'autres applications ».
 */
internal object LockOverlay {
  private val main = Handler(Looper.getMainLooper())
  private var view: View? = null
  private var shownHash: String? = null
  private var attempts = 0
  private var blockedUntil = 0L

  fun canDraw(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

  fun isShowing(): Boolean = view != null

  /** Réaffiche l'écran si le mode perdu est actif (au démarrage du service, sans réseau). */
  fun restore(context: Context) {
    val prefs = Prefs.get(context)
    val hash = prefs.getString("lockHash", null) ?: return
    if (!prefs.getBoolean("lostMode", false) || hash == prefs.getString("unlockedFor", null)) return
    show(
      context,
      prefs.getString("deviceId", "") ?: "",
      hash,
      prefs.getString("lostMessage", null) ?: "Ce téléphone a été perdu.",
      Prefs.contactPhone(context),
    )
  }

  fun show(context: Context, deviceId: String, hash: String, message: String, phone: String?) {
    val ctx = context.applicationContext
    Prefs.get(ctx).edit()
      .putString("lockHash", hash)
      .putString("deviceId", deviceId)
      .putString("lostMessage", message)
      .apply()
    if (!canDraw(ctx)) return
    main.post {
      if (view != null && shownHash == hash) return@post
      removeNow(ctx)
      attempts = 0
      try {
        val v = build(ctx, deviceId, hash, message, phone)
        windowManager(ctx).addView(v, layoutParams())
        view = v
        shownHash = hash
      } catch (_: Exception) {
        // Autorisation retirée entre-temps.
      }
    }
  }

  fun hide(context: Context) {
    val ctx = context.applicationContext
    main.post { removeNow(ctx) }
  }

  private fun removeNow(ctx: Context) {
    view?.let {
      try {
        windowManager(ctx).removeView(it)
      } catch (_: Exception) {
      }
    }
    view = null
    shownHash = null
  }

  private fun windowManager(ctx: Context) = ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager

  @Suppress("DEPRECATION")
  private fun layoutParams(): WindowManager.LayoutParams {
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      WindowManager.LayoutParams.TYPE_PHONE
    }
    return WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      PixelFormat.OPAQUE,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
    }
  }

  private fun sha256(text: String): String =
    MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }

  private fun dp(ctx: Context, v: Int) =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), ctx.resources.displayMetrics).toInt()

  /** Racine qui avale le bouton Retour : impossible de fermer l'écran sans le code. */
  private class Root(ctx: Context) : FrameLayout(ctx) {
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      if (event.keyCode == KeyEvent.KEYCODE_BACK) return true
      return super.dispatchKeyEvent(event)
    }
  }

  @SuppressLint("SetTextI18n")
  private fun build(ctx: Context, deviceId: String, hash: String, message: String, phone: String?): View {
    val root = Root(ctx).apply { setBackgroundColor(Color.parseColor("#B91C1C")) }
    val scroll = ScrollView(ctx)
    val col = LinearLayout(ctx).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(ctx, 28), dp(ctx, 64), dp(ctx, 28), dp(ctx, 32))
    }
    fun label(text: String, size: Float, bold: Boolean = false, color: String = "#FFFFFF") = TextView(ctx).apply {
      this.text = text
      textSize = size
      setTextColor(Color.parseColor(color))
      gravity = Gravity.CENTER
      if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, dp(ctx, 8), 0, dp(ctx, 8))
    }
    col.addView(label("📱🔒", 52f))
    col.addView(label("Ce téléphone est perdu", 28f, bold = true))
    col.addView(label(message, 18f, color = "#FEE2E2"))
    if (!phone.isNullOrEmpty()) col.addView(label("Merci d'appeler le $phone", 20f, bold = true))
    col.addView(label("Il est bloqué par Retrouve. Sa position est transmise à son propriétaire.", 14f, color = "#FECACA"))

    val input = EditText(ctx).apply {
      hint = "Code de déblocage (6 chiffres)"
      setHintTextColor(Color.parseColor("#9CA3AF"))
      setTextColor(Color.BLACK)
      setBackgroundColor(Color.WHITE)
      inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
      filters = arrayOf(InputFilter.LengthFilter(6))
      textSize = 22f
      gravity = Gravity.CENTER
      setPadding(dp(ctx, 12), dp(ctx, 12), dp(ctx, 12), dp(ctx, 12))
    }
    val error = label("", 15f, bold = true, color = "#FDE68A")
    val button = Button(ctx).apply { text = "Débloquer" }
    button.setOnClickListener {
      val now = System.currentTimeMillis()
      if (now < blockedUntil) {
        error.text = "Trop d'essais. Réessayez dans ${(blockedUntil - now) / 1000 + 1} s."
        return@setOnClickListener
      }
      val code = input.text.toString()
      if (code.length == 6 && sha256("$deviceId:$code") == hash) {
        // Bon code : fin du mode perdu sur le téléphone et sur le site.
        Prefs.get(ctx).edit().putString("unlockedFor", hash).putBoolean("lostMode", false).apply()
        removeNow(ctx)
        thread {
          try {
            ApiClient.request(ctx, "POST", "/api/agent/unlock", JSONObject().put("code", code))
          } catch (_: Exception) {
          }
          AgentCore.sync(ctx, null, false)
        }
      } else {
        attempts++
        input.setText("")
        error.text = "Code incorrect ($attempts)."
        if (attempts % 3 == 0) {
          blockedUntil = now + 30_000
          val count = attempts
          thread {
            val loc = LocationHelper.currentBlocking(ctx, 15_000)
            val data = JSONObject().put("failedAttempts", count).put("source", "lockScreen")
            if (loc != null) data.put("lat", loc.latitude).put("lng", loc.longitude)
            ApiClient.sendAlert(ctx, "FAILED_UNLOCK", data)
          }
        }
      }
    }
    val inputParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(ctx, 24)
    }
    col.addView(input, inputParams)
    col.addView(button, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(ctx, 12)
    })
    col.addView(error)
    scroll.addView(col)
    root.addView(scroll)
    return root
  }
}
