package mg.retrouve.nativemodule

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager

/**
 * Écran de blocage du mode perdu : couvre tout l'écran, par-dessus toutes les applications,
 * et ne disparaît qu'avec le code de déblocage affiché sur le site Retrouve.
 * Nécessite l'autorisation « Afficher par-dessus d'autres applications ».
 */
internal object LockOverlay {
  private val main = Handler(Looper.getMainLooper())
  private var view: View? = null
  private var shownHash: String? = null
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
      // L'écran sur le verrouillage (LostActivity) est déjà affiché : pas de doublon.
      if (LostActivity.visible) return@post
      if (view != null && shownHash == hash) return@post
      removeNow(ctx)
      try {
        val built = LostScreenView.build(ctx) { code -> submit(ctx, code) }
        setError = built.setError
        clearInput = built.clearInput
        windowManager(ctx).addView(built.view, layoutParams())
        view = built.view
        shownHash = hash
      } catch (_: Exception) {
        // Autorisation retirée entre-temps.
      }
    }
  }

  private var setError: (String) -> Unit = {}
  private var clearInput: () -> Unit = {}

  private fun submit(ctx: Context, code: String) {
    val now = System.currentTimeMillis()
    if (now < blockedUntil) {
      setError("Trop d'essais. Réessayez dans ${(blockedUntil - now) / 1000 + 1} s.")
      return
    }
    if (LostUnlock.tryCode(ctx, code)) {
      removeNow(ctx)
      return
    }
    clearInput()
    // Photo : l'écran Retrouve passe au premier plan (seul moyen d'utiliser la caméra), puis la prend.
    val attempts = Prefs.get(ctx).getInt("wrongAttempts", 0) + 1
    setError("Code incorrect ($attempts). Une photo a été envoyée au propriétaire.")
    if (attempts % 3 == 0) blockedUntil = now + 30_000
    LostUnlock.onWrongAttempt(ctx, "lockScreen")
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
}
