package mg.retrouve.nativemodule

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager

/**
 * Service de premier plan (notification permanente « Retrouve protège cet appareil »).
 * Il continue de tourner quand l'application est fermée ou balayée, et redémarre
 * après un redémarrage du téléphone ou une mise à jour de l'application.
 */
class AgentService : Service() {
  companion object {
    private const val CHANNEL = "retrouve_agent"
    private const val NOTIFICATION_ID = 4141
    const val ACTION_START = "mg.retrouve.agent.START"
    const val ACTION_SYNC = "mg.retrouve.agent.SYNC"
    const val ACTION_RECONFIGURE = "mg.retrouve.agent.RECONFIGURE"

    @Volatile
    var running = false
      private set

    /** Démarre le service. Renvoie false si Android l'interdit (ex. application restreinte). */
    fun start(context: Context, action: String = ACTION_START, locate: Boolean = false): Boolean {
      val intent = Intent(context, AgentService::class.java).setAction(action).putExtra("locate", locate)
      return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
        else context.startService(intent)
        true
      } catch (_: Exception) {
        false
      }
    }

    fun reconfigure(context: Context) {
      if (running) start(context, ACTION_RECONFIGURE)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, AgentService::class.java))
    }
  }

  private lateinit var thread: HandlerThread
  private lateinit var handler: Handler
  private var listener: LocationListener? = null
  private var registeredInterval = 0
  private var registeredLost = false
  private var lastLocationSync = 0L

  private val poll = object : Runnable {
    override fun run() {
      syncWithWakeLock(null, false)
      handler.postDelayed(this, if (Prefs.lostMode(this@AgentService)) 30_000L else 60_000L)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    thread = HandlerThread("retrouve-agent").also { it.start() }
    handler = Handler(thread.looper)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // startForeground doit être appelé rapidement après startForegroundService, sinon Android plante l'app.
    val foreground = goForeground()
    if (!foreground || !Prefs.enabled(this) || Prefs.token(this) == null) {
      if (foreground) stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }
    running = true
    when (intent?.action) {
      ACTION_SYNC -> handler.post { syncWithWakeLock(null, intent.getBooleanExtra("locate", false)) }
      ACTION_RECONFIGURE -> handler.post { registerLocationUpdates() }
      else -> {
        handler.removeCallbacks(poll)
        handler.post { registerLocationUpdates() }
        handler.post(poll)
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    running = false
    handler.removeCallbacksAndMessages(null)
    listener?.let { (getSystemService(Context.LOCATION_SERVICE) as LocationManager).removeUpdates(it) }
    thread.quitSafely()
    super.onDestroy()
  }

  private fun goForeground(): Boolean {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Protection Retrouve", NotificationManager.IMPORTANCE_LOW).apply {
          setShowBadge(false)
        }
      )
    }
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("Retrouve protège cet appareil")
      .setContentText("La position est envoyée régulièrement au compte du propriétaire.")
      .setOngoing(true)
      .setContentIntent(AgentCore.launchIntent(this))
      .build()
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      true
    } catch (_: Exception) {
      // Permission de localisation absente ou démarrage interdit par Android.
      false
    }
  }

  @SuppressLint("MissingPermission")
  private fun registerLocationUpdates() {
    val granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (!granted) return
    val interval = Prefs.intervalSec(this)
    val lost = Prefs.lostMode(this)
    if (listener != null && interval == registeredInterval && lost == registeredLost) return
    val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    listener?.let { lm.removeUpdates(it) }
    val l = object : LocationListener {
      override fun onLocationChanged(location: Location) {
        // Une position par intervalle suffit (plusieurs fournisseurs peuvent répondre).
        val now = System.currentTimeMillis()
        if (now - lastLocationSync < Prefs.intervalSec(this@AgentService) * 800L) return
        lastLocationSync = now
        handler.post { syncWithWakeLock(location, false) }
      }

      @Deprecated("Deprecated in Java")
      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
      override fun onProviderEnabled(provider: String) {}
      override fun onProviderDisabled(provider: String) {}
    }
    val providers = buildList {
      if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) add(LocationManager.NETWORK_PROVIDER)
      if (lost || isEmpty()) {
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) add(LocationManager.GPS_PROVIDER)
      }
      add(LocationManager.PASSIVE_PROVIDER)
    }
    for (p in providers) {
      try {
        lm.requestLocationUpdates(p, interval * 1000L, 0f, l, thread.looper)
      } catch (_: Exception) {
      }
    }
    listener = l
    registeredInterval = interval
    registeredLost = lost
  }

  private fun syncWithWakeLock(location: Location?, locate: Boolean) {
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    val wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "retrouve:sync")
    wl.acquire(60_000)
    try {
      AgentCore.sync(this, location, locate)
    } finally {
      if (wl.isHeld) wl.release()
    }
    if (!Prefs.enabled(this)) stopSelf()
  }
}
