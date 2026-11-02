/** Formatages pour l'interface (côté client et serveur). */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 45) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/** Un appareil est « en ligne » s'il a donné signe de vie depuis moins de 15 min. */
export function isOnline(iso: string | null | undefined, minutes = 15): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() < minutes * 60_000;
}

export const DEVICE_ICON: Record<string, string> = {
  PHONE: "📱",
  TABLET: "💻",
  COMPUTER: "🖥️",
  TRACKER: "📍",
};
