"use client";

import { useState } from "react";
import type { DeviceDTO } from "@retrouve/shared";
import { DeviceForm } from "@/components/DeviceForm";
import { PairingPanel } from "@/components/PairingPanel";
import { Card, PageTitle } from "@/components/ui";

export default function NewDevicePage() {
  const [device, setDevice] = useState<DeviceDTO | null>(null);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Ajouter un appareil" subtitle="Étape 1 : informations · Étape 2 : association avec l'application" />
      {!device ? (
        <Card>
          <DeviceForm onSaved={setDevice} submitLabel="Continuer" />
        </Card>
      ) : (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Associer « {device.name} »</h2>
          <PairingPanel deviceId={device.id} autoStart />
        </Card>
      )}
    </div>
  );
}
