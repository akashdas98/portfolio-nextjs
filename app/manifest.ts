import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Akash Das — Senior Software Engineer",
    short_name: "Akash Das",
    description:
      "Clean, reliable websites and web applications built end to end.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0d10",
    theme_color: "#0a0d10",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
