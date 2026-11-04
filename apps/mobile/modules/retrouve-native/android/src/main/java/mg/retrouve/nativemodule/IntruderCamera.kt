package mg.retrouve.nativemodule

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Size
import org.json.JSONObject
import java.io.File
import kotlin.concurrent.thread

/**
 * Photo de la personne qui tente de déverrouiller un téléphone en mode perdu (caméra frontale).
 * Android n'autorise la caméra que lorsque l'écran Retrouve est au premier plan (LostActivity).
 */
internal object IntruderCamera {
  @Volatile
  private var busy = false

  fun hasPermission(context: Context) =
    context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

  /**
   * Prend une photo JPEG et la renvoie, ou null avec la raison de l'échec (délai max 8 s).
   * Raisons : permission, busy, no-camera, open-error-N, disconnected, config-failed, timeout, exception.
   */
  @Suppress("MissingPermission", "DEPRECATION")
  fun capture(context: Context, callback: (ByteArray?, String?) -> Unit) {
    if (!hasPermission(context)) {
      callback(null, "permission")
      return
    }
    if (busy) {
      callback(null, "busy")
      return
    }
    busy = true
    val ht = HandlerThread("retrouve-camera").also { it.start() }
    val handler = Handler(ht.looper)
    var device: CameraDevice? = null
    var reader: ImageReader? = null
    var done = false
    fun finish(bytes: ByteArray?, reason: String? = null) {
      synchronized(this) {
        if (done) return
        done = true
      }
      try { device?.close() } catch (_: Exception) {}
      try { reader?.close() } catch (_: Exception) {}
      ht.quitSafely()
      busy = false
      callback(bytes, if (bytes == null) reason ?: "unknown" else null)
    }
    handler.postDelayed({ finish(null, "timeout") }, 8_000)
    try {
      val cm = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
      val id = cm.cameraIdList.firstOrNull {
        cm.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
      } ?: cm.cameraIdList.firstOrNull() ?: return finish(null, "no-camera")
      val chars = cm.getCameraCharacteristics(id)
      val sizes = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)?.getOutputSizes(ImageFormat.JPEG)
      val size = sizes?.filter { it.width <= 1280 }?.maxByOrNull { it.width * it.height }
        ?: sizes?.minByOrNull { it.width * it.height } ?: Size(640, 480)
      val orientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 270
      val r = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 2)
      reader = r
      cm.openCamera(id, object : CameraDevice.StateCallback() {
        override fun onOpened(cam: CameraDevice) {
          device = cam
          try {
            cam.createCaptureSession(listOf(r.surface), object : CameraCaptureSession.StateCallback() {
              override fun onConfigured(session: CameraCaptureSession) {
                try {
                  // Quelques images « à blanc » pour laisser l'exposition s'adapter à la lumière.
                  r.setOnImageAvailableListener({ it.acquireLatestImage()?.close() }, handler)
                  val warm = cam.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                    addTarget(r.surface)
                    set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                  }
                  session.setRepeatingRequest(warm.build(), null, handler)
                  handler.postDelayed({
                    try {
                      session.stopRepeating()
                      r.setOnImageAvailableListener({ rd ->
                        val img = rd.acquireLatestImage() ?: return@setOnImageAvailableListener
                        val buf = img.planes[0].buffer
                        val bytes = ByteArray(buf.remaining()).also { buf.get(it) }
                        img.close()
                        finish(bytes)
                      }, handler)
                      val still = cam.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
                        addTarget(r.surface)
                        set(CaptureRequest.JPEG_ORIENTATION, orientation)
                        set(CaptureRequest.JPEG_QUALITY, 80.toByte())
                      }
                      session.capture(still.build(), null, handler)
                    } catch (e: Exception) {
                      finish(null, "capture-" + e.javaClass.simpleName)
                    }
                  }, 1_200)
                } catch (e: Exception) {
                  finish(null, "preview-" + e.javaClass.simpleName)
                }
              }

              override fun onConfigureFailed(session: CameraCaptureSession) = finish(null, "config-failed")
            }, handler)
          } catch (e: Exception) {
            finish(null, "session-" + e.javaClass.simpleName)
          }
        }

        override fun onDisconnected(cam: CameraDevice) = finish(null, "disconnected")
        override fun onError(cam: CameraDevice, error: Int) = finish(null, "open-error-$error")
      }, handler)
    } catch (e: Exception) {
      finish(null, "open-" + e.javaClass.simpleName)
    }
  }
}

/** Envoi des alertes « intrus » (photo + position), gardées sur le téléphone si pas de réseau. */
internal object IntruderReporter {
  private fun pendingDir(context: Context) = File(context.filesDir, "pending_alerts").apply { mkdirs() }

  fun report(context: Context, photo: ByteArray?, attempts: Int, source: String, photoError: String? = null) {
    val ctx = context.applicationContext
    thread {
      val data = JSONObject().put("failedAttempts", attempts).put("source", source)
      if (photo == null && photoError != null) data.put("photoError", photoError.take(60))
      val loc = LocationHelper.currentBlocking(ctx, 12_000)
      if (loc != null) {
        data.put("lat", loc.latitude).put("lng", loc.longitude)
        if (loc.hasAccuracy()) data.put("accuracy", loc.accuracy.toInt())
        try { ApiClient.sendLocation(ctx, loc, "GPS") } catch (_: Exception) {}
      }
      val body = JSONObject()
        .put("type", if (photo != null) "INTRUDER_PHOTO" else "FAILED_UNLOCK")
        .put("data", data)
      if (photo != null) body.put("photoBase64", Base64.encodeToString(photo, Base64.NO_WRAP))
      try {
        ApiClient.request(ctx, "POST", "/api/agent/alerts", body)
      } catch (e: ApiException) {
        if (e.status == 0 || e.status >= 500 || e.status == 429) save(ctx, body)
      } catch (_: Exception) {
        save(ctx, body)
      }
    }
  }

  private fun save(context: Context, body: JSONObject) {
    val dir = pendingDir(context)
    // 20 alertes en attente au maximum (les plus anciennes sont supprimées).
    dir.listFiles()?.sortedBy { it.name }?.dropLast(19)?.forEach { it.delete() }
    File(dir, "${System.currentTimeMillis()}.json").writeText(body.toString())
  }

  /** Renvoie les alertes gardées hors ligne (appelé à chaque synchronisation réussie). */
  fun flush(context: Context) {
    val files = pendingDir(context).listFiles()?.sortedBy { it.name } ?: return
    for (f in files) {
      try {
        ApiClient.request(context, "POST", "/api/agent/alerts", JSONObject(f.readText()))
        f.delete()
      } catch (e: ApiException) {
        if (e.status in 400..499 && e.status != 429) f.delete() else return
      } catch (_: Exception) {
        return
      }
    }
  }
}
