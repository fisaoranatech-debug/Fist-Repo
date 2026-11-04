"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Proposer d'installer le site comme une application (écran d'accueil). */
export function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="text-sm text-emerald-600">✓ Le site est installé sur cet appareil.</p>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Installer le site</p>
        <p className="text-xs text-muted">
          {prompt
            ? "Ajoutez Retrouve à votre écran d'accueil pour l'ouvrir comme une application."
            : ios
              ? "Sur iPhone : bouton Partager → « Sur l'écran d'accueil »."
              : "Dans le menu du navigateur, choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil »."}
        </p>
      </div>
      {prompt && (
        <Button
          variant="secondary"
          onClick={async () => {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
        >
          Installer
        </Button>
      )}
    </div>
  );
}
