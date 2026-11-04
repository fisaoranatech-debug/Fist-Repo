package mg.retrouve.nativemodule

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.security.MessageDigest

/**
 * Mise à jour intégrée : la dernière version est publiée par GitHub Actions dans la Release
 * « android-latest » (retrouve.apk + version.json). Android demande une confirmation
 * (« Installer ? ») : c'est obligatoire pour une application installée hors du Play Store.
 */
internal object Updater {
  const val MANIFEST_URL =
    "https://github.com/fisaoranatech-debug/Fist-Repo/releases/download/android-latest/version.json"
  private const val CHANNEL = "retrouve_updates"
  private const val NOTIFICATION_ID = 4343
  private const val CHECK_EVERY_MS = 12 * 3600_000L

  /** -1 : rien en cours ; 0 à 100 : téléchargement ; 101 : terminé. */
  @Volatile
  var progress = -1

  fun currentVersionCode(context: Context): Long {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    @Suppress("DEPRECATION")
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
  }

  fun canInstall(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()

  private fun open(url: String): HttpURLConnection {
    val conn = java.net.URI(url).toURL().openConnection() as HttpURLConnection
    conn.instanceFollowRedirects = true
    conn.connectTimeout = 15_000
    conn.readTimeout = 30_000
    conn.setRequestProperty("Accept", "*/*")
    return conn
  }

  fun fetchManifest(): JSONObject? = try {
    val conn = open(MANIFEST_URL + "?t=" + System.currentTimeMillis())
    try {
      if (conn.responseCode in 200..299) JSONObject(conn.inputStream.bufferedReader().use { it.readText() }) else null
    } finally {
      conn.disconnect()
    }
  } catch (_: Exception) {
    null
  }

  fun apkFile(context: Context): File = File(File(context.cacheDir, "updates").apply { mkdirs() }, "retrouve.apk")

  /** Télécharge l'APK (bloquant, hors du thread principal). */
  fun download(context: Context, url: String): File {
    progress = 0
    val file = apkFile(context)
    val conn = open(url)
    try {
      if (conn.responseCode !in 200..299) throw IllegalStateException("Téléchargement impossible (${conn.responseCode})")
      val total = conn.contentLengthLong
      var done = 0L
      conn.inputStream.use { input ->
        file.outputStream().use { output ->
          val buf = ByteArray(64 * 1024)
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            output.write(buf, 0, n)
            done += n
            if (total > 0) progress = ((done * 100) / total).toInt().coerceIn(0, 100)
          }
        }
      }
      progress = 101
      return file
    } catch (e: Exception) {
      progress = -1
      throw e
    } finally {
      conn.disconnect()
    }
  }

  fun sha256(file: File): String {
    val md = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buf = ByteArray(64 * 1024)
      while (true) {
        val n = input.read(buf)
        if (n < 0) break
        md.update(buf, 0, n)
      }
    }
    return md.digest().joinToString("") { "%02x".format(it) }
  }

  /** Ouvre l'installateur d'Android (« Installer ? »). */
  fun install(context: Context) {
    val uri = Uri.parse("content://${context.packageName}.retrouve.updates/retrouve.apk")
    val intent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  /** Vérification en arrière-plan (au plus toutes les 12 h) et notification si une version est disponible. */
  fun maybeNotify(context: Context) {
    val prefs = Prefs.get(context)
    val now = System.currentTimeMillis()
    if (now - prefs.getLong("lastUpdateCheck", 0) < CHECK_EVERY_MS) return
    prefs.edit().putLong("lastUpdateCheck", now).apply()
    val manifest = fetchManifest() ?: return
    val latest = manifest.optLong("versionCode", 0)
    if (latest <= currentVersionCode(context) || prefs.getLong("notifiedVersion", 0) == latest) return
    prefs.edit().putLong("notifiedVersion", latest).apply()
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "Mises à jour", NotificationManager.IMPORTANCE_DEFAULT))
    }
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
    val n = builder
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setContentTitle("Mise à jour de Retrouve disponible")
      .setContentText("Touchez pour installer la version n°$latest.")
      .setAutoCancel(true)
      .setContentIntent(AgentCore.launchIntent(context))
      .build()
    try {
      nm.notify(NOTIFICATION_ID, n)
    } catch (_: SecurityException) {
    }
  }
}

/** Fournit l'APK téléchargé à l'installateur d'Android (accès temporaire en lecture seule). */
class UpdateFileProvider : ContentProvider() {
  override fun onCreate(): Boolean = true
  override fun getType(uri: Uri): String = "application/vnd.android.package-archive"
  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor =
    ParcelFileDescriptor.open(Updater.apkFile(context!!), ParcelFileDescriptor.MODE_READ_ONLY)
  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
