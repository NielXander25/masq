import type { MetadataRoute } from "next";

// Makes masqq installable: "Add to Home Screen" / "Install app".
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "masqq",
    short_name: "masqq",
    description: "Hosting calls anonymously, now made easy.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    categories: ["communication", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
