import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Retrouve : localiser mes appareils",
    short_name: "Retrouve",
    description: "Localisez vos téléphones et appareils perdus ou volés, et ceux de votre famille.",
    id: "/",
    start_url: "/appareils",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    background_color: "#f6f7fb",
    theme_color: "#2453e6",
    categories: ["utilities", "security"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mes appareils", url: "/appareils" },
      { name: "Alertes", url: "/alertes" },
    ],
  };
}
