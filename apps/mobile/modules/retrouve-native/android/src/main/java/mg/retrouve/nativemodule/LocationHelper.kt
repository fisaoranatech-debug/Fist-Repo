package mg.retrouve.nativemodule

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors

/** Position la plus fraîche possible, sans dépendre de la partie JavaScript. */
internal object LocationHelper {
  private fun hasPermission(context: Context): Boolean =
    context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  @Suppress("MissingPermission")
  fun lastKnown(context: Context): Location? {
    if (!hasPermission(context)) return null
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
      .mapNotNull { provider ->
        try {
          lm.getLastKnownLocation(provider)
        } catch (_: Exception) {
          null
        }
      }
      .maxByOrNull { it.time }
  }

  /**
   * Demande une position actuelle (Android 11+) avec un délai maximum,
   * sinon renvoie la dernière position connue.
   */
  @Suppress("MissingPermission")
  fun current(context: Context, timeoutMs: Long, callback: (Location?) -> Unit) {
    if (hasPermission(context) && FusedLocation.available(context)) {
      // Localisation de Google (GPS + Wi-Fi) avec délai maximum, puis repli sur le système Android.
      var done = false
      val lock = Any()
      val finish = { loc: Location? ->
        synchronized(lock) {
          if (!done) {
            done = true
            if (loc != null) callback(loc) else currentSystem(context, timeoutMs / 2, callback)
          }
        }
      }
      Handler(Looper.getMainLooper()).postDelayed({ finish(null) }, timeoutMs)
      FusedLocation.current(context, true) { loc -> finish(loc) }
      return
    }
    currentSystem(context, timeoutMs, callback)
  }

  @Suppress("MissingPermission")
  private fun currentSystem(context: Context, timeoutMs: Long, callback: (Location?) -> Unit) {
    val fallback = lastKnown(context)
    if (!hasPermission(context) || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      callback(fallback)
      return
    }
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val provider = when {
      lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
      lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
      else -> null
    }
    if (provider == null) {
      callback(fallback)
      return
    }
    val signal = CancellationSignal()
    var done = false
    val finish = { loc: Location? ->
      synchronized(this) {
        if (!done) {
          done = true
          callback(loc ?: fallback)
        }
      }
    }
    Handler(Looper.getMainLooper()).postDelayed({
      signal.cancel()
      finish(null)
    }, timeoutMs)
    try {
      lm.getCurrentLocation(provider, signal, Executors.newSingleThreadExecutor()) { loc -> finish(loc) }
    } catch (_: Exception) {
      finish(null)
    }
  }

  /** Source affichée sur le site : GPS si le fix est précis, sinon réseau (Wi-Fi / antennes). */
  fun sourceOf(loc: Location): String = when {
    loc.provider == LocationManager.GPS_PROVIDER -> "GPS"
    loc.hasAccuracy() && loc.accuracy <= 30f -> "GPS"
    else -> "NETWORK"
  }

  fun mapLink(loc: Location): String =
    "https://maps.google.com/?q=%.6f,%.6f".format(java.util.Locale.US, loc.latitude, loc.longitude)
}

/** Position actuelle en attendant au plus `timeoutMs` (à appeler hors du thread principal). */
internal fun LocationHelper.currentBlocking(context: Context, timeoutMs: Long): Location? {
  val latch = java.util.concurrent.CountDownLatch(1)
  var result: Location? = null
  current(context, timeoutMs) { loc ->
    result = loc
    latch.countDown()
  }
  latch.await(timeoutMs + 2_000, java.util.concurrent.TimeUnit.MILLISECONDS)
  return result ?: lastKnown(context)
}
