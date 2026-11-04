package mg.retrouve.nativemodule

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager

/**
 * Écran du mode perdu affiché PAR-DESSUS l'écran de verrouillage (comme un appel entrant).
 * Au premier plan, il a le droit d'utiliser la caméra : photo à chaque mauvais code.
 */
class LostActivity : Activity() {
  companion object {
    @Volatile
    var visible = false
      private set
  }

  private var blockedUntil = 0L
  private lateinit var screen: LostScreenView.Built

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (!LostUnlock.active(this)) {
      finish()
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    screen = LostScreenView.build(this) { code -> submit(code) }
    setContentView(screen.view)
    handle(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    if (!LostUnlock.active(this)) {
      finish()
      return
    }
    handle(intent)
  }

  override fun onResume() {
    super.onResume()
    visible = true
    LockOverlay.hide(this)
  }

  override fun onPause() {
    super.onPause()
    visible = false
    // Si la personne quitte cet écran (téléphone déverrouillé), la fenêtre de blocage reprend le relais.
    if (LostUnlock.active(this)) LockOverlay.restore(this)
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    // Retour désactivé : seul le code débloque le téléphone.
  }

  private fun handle(intent: Intent?) {
    if (intent?.getBooleanExtra("capture", false) == true) {
      intent.putExtra("capture", false)
      photo(intent.getIntExtra("attempts", 0), intent.getStringExtra("source") ?: "devicePin")
    }
  }

  private fun photo(attempts: Int, source: String) {
    IntruderCamera.capture(this) { bytes -> IntruderReporter.report(this, bytes, attempts, source) }
  }

  private fun submit(code: String) {
    val now = System.currentTimeMillis()
    if (now < blockedUntil) {
      screen.setError("Trop d'essais. Réessayez dans ${(blockedUntil - now) / 1000 + 1} s.")
      return
    }
    if (LostUnlock.tryCode(this, code)) {
      finish()
      return
    }
    val attempts = LostUnlock.recordWrongAttempt(this)
    screen.clearInput()
    screen.setError("Code incorrect ($attempts). Une photo a été envoyée au propriétaire.")
    if (attempts % 3 == 0) blockedUntil = now + 30_000
    // Photo + position à CHAQUE mauvais code.
    photo(attempts, "lockScreen")
  }
}
