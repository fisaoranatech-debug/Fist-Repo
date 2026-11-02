import { z } from "zod";
import {
  ALERT_TYPES,
  COMMAND_TYPES,
  DEVICE_TYPES,
  LOCATION_SOURCES,
  SHARE_ROLES,
} from "./enums";

/** IMEI : 15 chiffres avec clé de Luhn valide (on accepte 14 chiffres sans clé). */
export function isValidImei(value: string): boolean {
  if (/^\d{14}$/.test(value)) return true;
  if (!/^\d{15}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(value[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const imei = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || isValidImei(v), {
    message: "IMEI invalide : 15 chiffres (tapez *#06# sur le téléphone pour l'afficher)",
  });

const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d][\d\s().-]*$/, "Numéro de téléphone invalide");

// ---------- Comptes ----------
const newPassword = z.string().min(8, "8 caractères minimum").max(200, "200 caractères maximum");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().toLowerCase().email("Email invalide").max(160),
  password: newPassword,
  contactPhone: phone.optional().or(z.literal("")),
  acceptTerms: z
    .union([z.literal(true), z.literal("on"), z.literal("true")], {
      error: "Vous devez accepter les conditions d'utilisation et la politique de confidentialité",
    })
    .transform(() => true as const),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  contactPhone: phone.optional().or(z.literal("")),
  emailAlerts: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Lien invalide").max(200),
  password: newPassword,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword,
});

export const accountDeleteSchema = z.object({
  password: z.string().min(1, "Mot de passe requis"),
});

/** Abonnement web push tel que fourni par le navigateur (PushSubscription.toJSON()). */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(8).max(100),
  }),
});

// ---------- Appareils (côté utilisateur) ----------
export const deviceCreateSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  type: z.enum(DEVICE_TYPES).default("PHONE"),
  model: z.string().trim().max(80).optional(),
  imei: imei.optional(),
  simNumber: phone.optional().or(z.literal("")),
});
export type DeviceCreateInput = z.infer<typeof deviceCreateSchema>;

export const deviceUpdateSchema = deviceCreateSchema.partial().extend({
  lostMessage: z.string().trim().max(300).optional(),
  smsSecret: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,12}$/, "Code SMS : 4 à 12 lettres ou chiffres")
    .optional()
    .or(z.literal("")),
});
export type DeviceUpdateInput = z.infer<typeof deviceUpdateSchema>;

export const pairingCodeRequestSchema = z.object({
  deviceId: z.string().min(1, "Appareil requis"),
});

export const commandCreateSchema = z.object({
  type: z.enum(COMMAND_TYPES),
  message: z.string().trim().max(300).optional(),
  contactPhone: phone.optional(),
  /** Obligatoire pour LOCK et WIPE. */
  password: z.string().optional(),
  /** Nouveau code PIN de verrouillage (LOCK, Android). */
  pin: z
    .string()
    .regex(/^\d{4,12}$/, "PIN : 4 à 12 chiffres")
    .optional(),
});
export type CommandCreateInput = z.infer<typeof commandCreateSchema>;

export const locationQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

export const geofenceSchema = z.object({
  name: z.string().trim().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(50).max(50000),
  enabled: z.boolean().default(true),
});
export type GeofenceInput = z.infer<typeof geofenceSchema>;

export const shareCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  role: z.enum(SHARE_ROLES).default("VIEWER"),
});

// ---------- Agent (côté appareil) ----------
export const pairSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres"),
  model: z.string().trim().max(80).optional(),
  platform: z.string().trim().max(40).optional(),
  osVersion: z.string().trim().max(40).optional(),
});
export type PairInput = z.infer<typeof pairSchema>;

export const locationPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(1_000_000).optional(),
  altitude: z.number().optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  battery: z.number().int().min(0).max(100).optional(),
  source: z.enum(LOCATION_SOURCES).default("GPS"),
  /** Date de la mesure (ISO ou millisecondes). */
  recordedAt: z.union([z.string().datetime({ offset: true }), z.number()]).transform((v) => new Date(v)),
});
export type LocationPointInput = z.input<typeof locationPointSchema>;
export type LocationPoint = z.output<typeof locationPointSchema>;

export const locationBatchSchema = z.object({
  points: z.array(locationPointSchema).min(1).max(500),
});

export const heartbeatSchema = z.object({
  battery: z.number().int().min(0).max(100).optional(),
  charging: z.boolean().optional(),
  carrierName: z.string().max(80).nullable().optional(),
  mcc: z.string().max(4).nullable().optional(),
  mnc: z.string().max(4).nullable().optional(),
  pushToken: z.string().max(300).nullable().optional(),
  appVersion: z.string().max(30).optional(),
  model: z.string().max(80).optional(),
  osVersion: z.string().max(40).optional(),
  /** Capacités réellement disponibles sur l'appareil (ex. "deviceAdmin", "sms"). */
  capabilities: z.array(z.string().max(30)).max(20).optional(),
});
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export const commandAckSchema = z.object({
  status: z.enum(["ACKED", "DONE", "FAILED"]),
  result: z.string().max(500).optional(),
});
export type CommandAckInput = z.infer<typeof commandAckSchema>;

export const agentAlertSchema = z.object({
  type: z.enum(ALERT_TYPES),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  /** Photo JPEG encodée en base64 (alerte INTRUDER_PHOTO), 2 Mo max. */
  photoBase64: z.string().max(2_800_000).optional(),
});
export type AgentAlertInput = z.infer<typeof agentAlertSchema>;
