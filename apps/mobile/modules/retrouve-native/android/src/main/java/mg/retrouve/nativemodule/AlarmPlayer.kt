package mg.retrouve.nativemodule

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Handler
import android.os.Looper

/**
 * Sonnerie forte sur le canal « alarme » : elle se fait entendre même en mode silencieux
 * ou vibreur (sauf « Ne pas déranger » strict sur certains téléphones).
 */
internal object AlarmPlayer {
  private var player: MediaPlayer? = null
  private var previousVolume: Int? = null
  private val handler = Handler(Looper.getMainLooper())
  private val stopRunnable = Runnable { stopInternal(null) }
  private var appContext: Context? = null

  @Synchronized
  fun start(context: Context, seconds: Int) {
    val ctx = context.applicationContext
    stopInternal(ctx)
    appContext = ctx
    val audio = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    previousVolume = audio.getStreamVolume(AudioManager.STREAM_ALARM)
    audio.setStreamVolume(AudioManager.STREAM_ALARM, audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)

    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      ?: return
    val mp = MediaPlayer()
    mp.setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
    )
    mp.setDataSource(ctx, uri)
    mp.isLooping = true
    mp.prepare()
    mp.start()
    player = mp
    handler.postDelayed(stopRunnable, seconds.coerceIn(5, 300) * 1000L)
  }

  @Synchronized
  fun stop(context: Context) = stopInternal(context.applicationContext)

  @Synchronized
  private fun stopInternal(context: Context?) {
    handler.removeCallbacks(stopRunnable)
    player?.let {
      try {
        if (it.isPlaying) it.stop()
      } catch (_: IllegalStateException) {
      }
      it.release()
    }
    player = null
    val ctx = context ?: appContext
    val prev = previousVolume
    if (ctx != null && prev != null) {
      val audio = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audio.setStreamVolume(AudioManager.STREAM_ALARM, prev, 0)
    }
    previousVolume = null
  }

  fun isPlaying(): Boolean = player?.isPlaying == true
}
