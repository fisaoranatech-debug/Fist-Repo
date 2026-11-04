package mg.retrouve.nativemodule

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailabilityLight
import com.google.android.gms.location.LocationListener
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource

/**
 * Localisation « fusionnée » de Google (GPS + Wi-Fi + antennes) : bien plus précise à l'intérieur
 * que le seul réseau mobile. Utilisée si les services Google sont présents, sinon repli sur LocationManager.
 */
internal object FusedLocation {
  fun available(context: Context): Boolean = try {
    GoogleApiAvailabilityLight.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
  } catch (_: Throwable) {
    false
  }

  @SuppressLint("MissingPermission")
  fun current(context: Context, highAccuracy: Boolean, callback: (Location?) -> Unit) {
    try {
      val cts = CancellationTokenSource()
      LocationServices.getFusedLocationProviderClient(context)
        .getCurrentLocation(if (highAccuracy) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY, cts.token)
        .addOnSuccessListener { loc -> callback(loc) }
        .addOnFailureListener { callback(null) }
    } catch (_: Throwable) {
      callback(null)
    }
  }

  @SuppressLint("MissingPermission")
  fun requestUpdates(context: Context, intervalMs: Long, highAccuracy: Boolean, listener: LocationListener, looper: Looper): Boolean = try {
    val request = LocationRequest.Builder(
      if (highAccuracy) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY,
      intervalMs,
    )
      .setMinUpdateIntervalMillis(intervalMs / 2)
      .setWaitForAccurateLocation(highAccuracy)
      .build()
    LocationServices.getFusedLocationProviderClient(context).requestLocationUpdates(request, listener, looper)
    true
  } catch (_: Throwable) {
    false
  }

  fun removeUpdates(context: Context, listener: LocationListener) {
    try {
      LocationServices.getFusedLocationProviderClient(context).removeLocationUpdates(listener)
    } catch (_: Throwable) {
    }
  }
}
