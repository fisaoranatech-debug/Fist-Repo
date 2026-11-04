/**
 * Position d'un ordinateur : il n'a généralement pas de GPS.
 * 1. Position fixe configurée (ordinateur de bureau qui ne bouge pas) ;
 * 2. sinon géolocalisation approximative par adresse IP (quartier ou ville).
 */
const PROVIDERS = [
  {
    url: "https://ipwho.is/",
    parse: (d) => (d.success === false ? null : { lat: d.latitude, lng: d.longitude, where: [d.city, d.country].filter(Boolean).join(", ") }),
  },
  {
    url: "https://ipapi.co/json/",
    parse: (d) => (d.error ? null : { lat: d.latitude, lng: d.longitude, where: [d.city, d.country_name].filter(Boolean).join(", ") }),
  },
  {
    url: "https://get.geojs.io/v1/ip/geo.json",
    parse: (d) => ({ lat: Number(d.latitude), lng: Number(d.longitude), where: [d.city, d.country].filter(Boolean).join(", ") }),
  },
];

export async function locate(cfg) {
  if (cfg.fixedLocation) {
    return { lat: cfg.fixedLocation.lat, lng: cfg.fixedLocation.lng, accuracy: 50, source: "NETWORK", where: "position fixe" };
  }
  for (const p of PROVIDERS) {
    try {
      const res = await fetch(p.url, { signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const r = p.parse(await res.json());
      if (r && Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
        return { ...r, accuracy: 5000, source: "IP" };
      }
    } catch {
      /* fournisseur suivant */
    }
  }
  return null;
}
