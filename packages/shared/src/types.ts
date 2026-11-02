import type {
  AlertType,
  CommandStatus,
  CommandType,
  DeviceType,
  LocationSource,
  ShareRole,
} from "./enums";

export interface LocationDTO {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  battery: number | null;
  source: LocationSource;
  recordedAt: string;
}

export interface DeviceDTO {
  id: string;
  name: string;
  type: DeviceType;
  model: string | null;
  imei: string | null;
  simNumber: string | null;
  platform: string | null;
  battery: number | null;
  charging: boolean | null;
  carrierName: string | null;
  lastSeenAt: string | null;
  paired: boolean;
  lostMode: boolean;
  lostMessage: string | null;
  capabilities: string[];
  hasSmsSecret: boolean;
  /** true si l'appareil a envoyé un jeton push (réveil instantané possible). */
  instantWakeUp: boolean;
  /** Rôle de l'utilisateur courant sur cet appareil. */
  access: "OWNER" | ShareRole;
  ownerName: string;
  lastLocation: LocationDTO | null;
}

export interface CommandDTO {
  id: string;
  type: CommandType;
  status: CommandStatus;
  payload: Record<string, unknown> | null;
  result: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDTO {
  id: string;
  deviceId: string;
  deviceName: string;
  type: AlertType;
  data: Record<string, unknown> | null;
  hasPhoto: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface GeofenceDTO {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  enabled: boolean;
}

export interface ShareDTO {
  id: string;
  email: string;
  name: string;
  role: ShareRole;
}

/** Commande telle que reçue par l'appareil. */
export interface AgentCommand {
  id: string;
  type: CommandType;
  payload: {
    message?: string;
    contactPhone?: string;
    pin?: string;
  } | null;
  createdAt: string;
}

export interface PairResponse {
  deviceId: string;
  token: string;
  name: string;
}

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

/** État renvoyé à l'appareil à chaque battement de cœur (synchronisation). */
export interface AgentState {
  deviceId: string;
  name: string;
  lostMode: boolean;
  lostMessage: string | null;
  /** Numéro à appeler affiché en mode perdu. */
  contactPhone: string | null;
  /** Code secret des commandes SMS, null si désactivé. */
  smsSecret: string | null;
  pendingCommands: number;
  /** Intervalle conseillé entre deux positions, en secondes. */
  intervalSec: number;
}

/** Intervalles d'envoi des positions. */
export const TRACKING_INTERVAL_SEC = { normal: 300, lost: 60 } as const;
