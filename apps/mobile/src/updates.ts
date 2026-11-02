import * as Application from "expo-application";
import { RetrouveNative } from "./native";

/** Publié par GitHub Actions à chaque nouvelle version (voir .github/workflows/android-apk.yml). */
export const UPDATE_MANIFEST_URL =
  "https://github.com/fisaoranatech-debug/Fist-Repo/releases/download/android-latest/version.json";

export interface UpdateManifest {
  versionCode: number;
  notes?: string;
  sha256?: string;
  size?: number;
  apkUrl: string;
}

export function currentVersionCode(): number {
  if (RetrouveNative) return RetrouveNative.getAppVersionCode();
  return Number(Application.nativeBuildVersion) || 0;
}

/** Renvoie la nouvelle version si elle est plus récente que celle installée, sinon null. */
export async function checkForUpdate(): Promise<UpdateManifest | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, { signal: controller.signal });
    if (!res.ok) return null;
    const m = (await res.json()) as UpdateManifest;
    if (!m?.versionCode || !m.apkUrl) return null;
    return m.versionCode > currentVersionCode() ? m : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
