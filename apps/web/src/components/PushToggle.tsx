"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Alert, Button } from "./ui";

function base64UrlToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "loading" | "unsupported" | "ios-install" | "server-off" | "denied" | "off" | "on";

/** Active les notifications d'alertes du navigateur sur cet appareil. */
export function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setStatus(ios && !standalone ? "ios-install" : "unsupported");
      }
      const { publicKey } = await api<{ publicKey: string | null }>("/api/push/key");
      if (!publicKey) return setStatus("server-off");
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.ready;
      setStatus((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const { publicKey } = await api<{ publicKey: string }>("/api/push/key");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) });
      await api("/api/push/subscribe", { body: sub.toJSON() });
      setStatus("on");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/api/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  const messages: Partial<Record<Status, string>> = {
    unsupported: "Ce navigateur ne gère pas les notifications.",
    "ios-install": "Sur iPhone, ajoutez d'abord le site à l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil »), puis ouvrez-le depuis l'icône pour activer les notifications (iOS 16.4 ou plus récent).",
    "server-off": "Les notifications du navigateur ne sont pas encore configurées sur le serveur (clés VAPID).",
    denied: "Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur.",
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Notifications sur cet appareil</p>
          <p className="text-xs text-muted">Une notification s&apos;affiche dès qu&apos;une alerte arrive, même site fermé.</p>
        </div>
        {status === "on" && <Button variant="secondary" onClick={disable} loading={busy}>Désactiver</Button>}
        {status === "off" && <Button onClick={enable} loading={busy}>Activer</Button>}
        {status === "loading" && <span className="text-xs text-muted">…</span>}
      </div>
      {messages[status] && <p className="text-xs text-amber-600 dark:text-amber-400">{messages[status]}</p>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
