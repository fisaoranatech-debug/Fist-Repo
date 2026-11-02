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

  fun mapLink(loc: Location): String =
    "https://maps.google.com/?q=%.6f,%.6f".format(java.util.Locale.US, loc.latitude, loc.longitude)
}
