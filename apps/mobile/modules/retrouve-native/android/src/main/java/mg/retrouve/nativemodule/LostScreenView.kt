package mg.retrouve.nativemodule

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.text.InputFilter
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Interface rouge « Ce téléphone est perdu » + saisie du code de déblocage (écran et fenêtre). */
internal object LostScreenView {
  class Built(val view: View, val setError: (String) -> Unit, val clearInput: () -> Unit)

  /** Racine qui avale le bouton Retour. */
  private class Root(ctx: Context) : FrameLayout(ctx) {
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      if (event.keyCode == KeyEvent.KEYCODE_BACK) return true
      return super.dispatchKeyEvent(event)
    }
  }

  private fun dp(ctx: Context, v: Int) =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), ctx.resources.displayMetrics).toInt()

  fun build(ctx: Context, onSubmit: (String) -> Unit): Built {
    val prefs = Prefs.get(ctx)
    val message = prefs.getString("lostMessage", null) ?: "Ce téléphone a été perdu."
    val phone = Prefs.contactPhone(ctx)
    val root = Root(ctx).apply { setBackgroundColor(Color.parseColor("#B91C1C")) }
    val col = LinearLayout(ctx).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(ctx, 28), dp(ctx, 56), dp(ctx, 28), dp(ctx, 32))
    }
    fun label(text: String, size: Float, bold: Boolean = false, color: String = "#FFFFFF") = TextView(ctx).apply {
      this.text = text
      textSize = size
      setTextColor(Color.parseColor(color))
      gravity = Gravity.CENTER
      if (bold) setTypeface(typeface, Typeface.BOLD)
      setPadding(0, dp(ctx, 8), 0, dp(ctx, 8))
    }
    col.addView(label("📱🔒", 52f))
    col.addView(label("Ce téléphone est perdu", 30f, bold = true))
    col.addView(label(message, 19f, color = "#FEE2E2"))
    if (!phone.isNullOrEmpty()) col.addView(label("Merci d'appeler le\n$phone", 22f, bold = true))
    col.addView(
      label(
        "Il est bloqué et localisé par Retrouve. Chaque tentative de déverrouillage est photographiée et envoyée à son propriétaire.",
        14f,
        color = "#FECACA",
      )
    )
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
    button.setOnClickListener { onSubmit(input.text.toString()) }
    col.addView(input, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(ctx, 24)
    })
    col.addView(button, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(ctx, 12)
    })
    col.addView(error)
    root.addView(ScrollView(ctx).apply { addView(col) })
    return Built(root, { error.text = it }, { input.setText("") })
  }
}
