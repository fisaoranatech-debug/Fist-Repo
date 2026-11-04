"use client";

import dynamic from "next/dynamic";

/** La carte Leaflet ne fonctionne que dans le navigateur. */
export const Map = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="surface-2 grid h-[420px] w-full place-items-center rounded-2xl text-sm text-muted">Chargement de la carte…</div>,
});
export type { MapDevice } from "./MapView";
