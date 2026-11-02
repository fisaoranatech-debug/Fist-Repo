import type { AlertType } from "./enums";

export const ALERT_ICONS: Record<AlertType, string> = {
  SIM_CHANGED: "📶",
  LOW_BATTERY: "🪫",
  GEOFENCE_EXIT: "🚧",
  INTRUDER_PHOTO: "📸",
  FAILED_UNLOCK: "🔐",
  OFFLINE: "📴",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Indian/Antananarivo" });
}

/** Phrase explicative d'une alerte (site, email, notification). */
export function describeAlert(type: AlertType, data: Record<string, unknown> | null | undefined): string {
  const d = (data ?? {}) as Record<string, string | number | null | undefined>;
  switch (type) {
    case "SIM_CHANGED":
      return `Opérateur : ${d.before ?? "?"} → ${d.after ?? "?"}. Quelqu'un a peut-être mis une autre carte SIM.`;
    case "LOW_BATTERY":
      return `Batterie à ${d.battery ?? "?"} %. La dernière position a été envoyée.`;
    case "GEOFENCE_EXIT":
      return `L'appareil est sorti de la zone « ${d.zone ?? ""} ».`;
    case "INTRUDER_PHOTO":
      return `Photo prise après ${d.failedAttempts ?? "plusieurs"} mauvais codes de déverrouillage.`;
    case "FAILED_UNLOCK":
      return `${d.failedAttempts ?? "Plusieurs"} mauvais codes de déverrouillage. Quelqu'un essaie peut-être d'utiliser l'appareil.`;
    case "OFFLINE":
      return `Aucune nouvelle depuis ${d.lastSeenAt ? formatDate(String(d.lastSeenAt)) : "plus de 24 h"}. Téléphone éteint, sans réseau ou application arrêtée.`;
  }
}
