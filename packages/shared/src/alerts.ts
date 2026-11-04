import type { AlertType } from "./enums";

export const ALERT_ICONS: Record<AlertType, string> = {
  SIM_CHANGED: "📶",
  LOW_BATTERY: "🪫",
  GEOFENCE_EXIT: "🚧",
  INTRUDER_PHOTO: "📸",
  FAILED_UNLOCK: "🔐",
  OFFLINE: "📴",
};

/** Raison d'échec de la photo de l'intrus, en français. */
export function photoErrorLabel(code: string): string {
  if (code === "permission") return "l'appareil photo n'est pas autorisé pour Retrouve sur le téléphone (Retrouve → Autorisations → Photo de l'intrus)";
  if (code === "screen-blocked") return "Android a empêché l'affichage de l'écran Retrouve (autorisez « Afficher par-dessus d'autres applications »)";
  if (code === "timeout") return "l'appareil photo n'a pas répondu à temps";
  if (code === "busy") return "une autre photo était déjà en cours";
  if (code === "no-camera") return "aucun appareil photo trouvé";
  return `erreur technique (${code})`;
}

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
      return `Photo de la personne qui tente de déverrouiller le téléphone (mauvais code n°${d.failedAttempts ?? "?"}${d.source === "lockScreen" ? ", code Retrouve" : d.source === "devicePin" ? ", code du téléphone" : ""}).`;
    case "FAILED_UNLOCK": {
      const base = `${d.failedAttempts ?? "Plusieurs"} mauvais codes de déverrouillage. Quelqu'un essaie peut-être d'utiliser l'appareil.`;
      return d.photoError ? `${base} Photo impossible : ${photoErrorLabel(String(d.photoError))}.` : base;
    }
    case "OFFLINE":
      return `Aucune nouvelle depuis ${d.lastSeenAt ? formatDate(String(d.lastSeenAt)) : "plus de 24 h"}. Téléphone éteint, sans réseau ou application arrêtée.`;
  }
}
