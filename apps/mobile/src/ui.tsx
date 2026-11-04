import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme, type TextInputProps, type ViewStyle } from "react-native";

export function useTheme() {
  const dark = useColorScheme() === "dark";
  return {
    dark,
    bg: dark ? "#0e1118" : "#f6f7fb",
    surface: dark ? "#161a24" : "#ffffff",
    border: dark ? "#2a3142" : "#e3e6ee",
    text: dark ? "#e8ebf2" : "#141824",
    muted: dark ? "#9aa3b5" : "#5c6475",
    brand: "#2453e6",
    danger: "#dc2626",
    success: "#059669",
    warning: "#d97706",
  };
}

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.text }]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = variant === "primary" ? t.brand : variant === "danger" ? t.danger : t.surface;
  const fg = variant === "secondary" ? t.text : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === "secondary" ? t.border : bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[styles.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }, props.style]}
    />
  );
}

export function StatusRow({ ok, label, detail, action }: { ok: boolean | null; label: string; detail?: string; action?: ReactNode }) {
  const t = useTheme();
  const color = ok === null ? t.muted : ok ? t.success : t.warning;
  return (
    <View style={styles.row}>
      <Text style={{ fontSize: 18, color }}>{ok === null ? "○" : ok ? "✓" : "!"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: t.text, fontWeight: "600" }]}>{label}</Text>
        {detail ? <Text style={[styles.small, { color: t.muted }]}>{detail}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 10 },
  title: { fontSize: 24, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  button: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
});
