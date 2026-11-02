import * as Device from "expo-device";
import { kvGet, kvSet } from "./db";

/** Instructions de « démarrage automatique » adaptées à la marque du téléphone. */
export function autostartHelp(): string {
  const brand = (Device.manufacturer ?? "").toLowerCase();
  if (brand.includes("huawei") || brand.includes("honor")) {
    return "Huawei : Paramètres → Batterie → Lancement d'applications → Retrouve → désactivez « Gérer automatiquement », puis activez les 3 options (Lancement auto, Lancement secondaire, Exécution en arrière-plan).";
  }
  if (brand.includes("xiaomi") || brand.includes("redmi") || brand.includes("poco")) {
    return "Xiaomi : Sécurité → Autorisations → Démarrage automatique → activez Retrouve. Puis Batterie → Retrouve → « Aucune restriction ».";
  }
  if (brand.includes("tecno") || brand.includes("infinix") || brand.includes("itel")) {
    return "Tecno / Infinix / itel : Phone Master → Gestion du démarrage automatique → activez Retrouve. Puis Batterie → Retrouve → « Ne pas optimiser ».";
  }
  if (brand.includes("samsung")) {
    return "Samsung : Paramètres → Applications → Retrouve → Batterie → « Sans restriction ». Vérifiez qu'elle n'est pas dans « Applications en veille ».";
  }
  if (brand.includes("oppo") || brand.includes("realme") || brand.includes("oneplus") || brand.includes("vivo")) {
    return "Paramètres → Batterie → Retrouve → autorisez l'activité en arrière-plan et le démarrage automatique.";
  }
  return "Autorisez Retrouve à démarrer seule et réglez sa batterie sur « Sans restriction ».";
}

export const isAutostartConfirmed = async () => (await kvGet<boolean>("autostartConfirmed")) === true;
export const confirmAutostart = (v: boolean) => kvSet("autostartConfirmed", v);
