export const DEVICE_TYPES = ["PHONE", "TABLET", "COMPUTER", "TRACKER"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const LOCATION_SOURCES = ["GPS", "NETWORK", "IP", "SMS"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const COMMAND_TYPES = [
  "RING",
  "LOCATE_NOW",
  "LOST_MODE_ON",
  "LOST_MODE_OFF",
  "LOCK",
  "WIPE",
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

/** Commandes dangereuses : le mot de passe du compte est redemandé. */
export const SENSITIVE_COMMANDS: readonly CommandType[] = ["LOCK", "WIPE"];

export const COMMAND_STATUSES = ["PENDING", "SENT", "ACKED", "DONE", "FAILED"] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const ALERT_TYPES = [
  "SIM_CHANGED",
  "LOW_BATTERY",
  "GEOFENCE_EXIT",
  "INTRUDER_PHOTO",
  "OFFLINE",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const SHARE_ROLES = ["VIEWER", "CONTROLLER"] as const;
export type ShareRole = (typeof SHARE_ROLES)[number];

/** Libellés français pour l'interface. */
export const LABELS = {
  deviceType: {
    PHONE: "Téléphone",
    TABLET: "Tablette",
    COMPUTER: "Ordinateur",
    TRACKER: "Traceur GPS",
  } satisfies Record<DeviceType, string>,
  command: {
    RING: "Faire sonner",
    LOCATE_NOW: "Localiser maintenant",
    LOST_MODE_ON: "Activer le mode perdu",
    LOST_MODE_OFF: "Désactiver le mode perdu",
    LOCK: "Verrouiller",
    WIPE: "Effacer toutes les données",
  } satisfies Record<CommandType, string>,
  commandStatus: {
    PENDING: "En attente",
    SENT: "Envoyée",
    ACKED: "Reçue par l'appareil",
    DONE: "Exécutée",
    FAILED: "Échec",
  } satisfies Record<CommandStatus, string>,
  alert: {
    SIM_CHANGED: "Carte SIM ou opérateur changé",
    LOW_BATTERY: "Batterie faible",
    GEOFENCE_EXIT: "Sortie de zone",
    INTRUDER_PHOTO: "Photo d'un intrus",
    OFFLINE: "Appareil hors ligne",
  } satisfies Record<AlertType, string>,
  source: {
    GPS: "GPS",
    NETWORK: "Réseau",
    IP: "Adresse IP",
    SMS: "SMS",
  } satisfies Record<LocationSource, string>,
  shareRole: {
    VIEWER: "Voir la position",
    CONTROLLER: "Voir et envoyer des commandes",
  } satisfies Record<ShareRole, string>,
};
