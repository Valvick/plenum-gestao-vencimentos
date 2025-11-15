import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),

    // ================================
    //   CONFIGURAÇÃO DO PWA DO PLENUM
    // ================================
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "plenum_icon_72x72.png",
        "plenum_icon_96x96.png",
        "plenum_icon_128x128.png",
        "plenum_icon_144x144.png",
        "plenum_icon_152x152.png",
        "plenum_icon_192x192.png",
        "plenum_icon_384x384.png",
        "plenum_icon_512x512.png"
      ],
      manifest: {
        name: "Plenum - Gestão de Vencimentos",
        short_name: "Plenum",
        description: "Sistema profissional de controle de cursos, exames e vencimentos.",
        theme_color: "#0f172a",
        background_color: "#020617",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "plenum_icon_72x72.png",
            sizes: "72x72",
            type: "image/png"
          },
          {
            src: "plenum_icon_96x96.png",
            sizes: "96x96",
            type: "image/png"
          },
          {
            src: "plenum_icon_128x128.png",
            sizes: "128x128",
            type: "image/png"
          },
          {
            src: "plenum_icon_144x144.png",
            sizes: "144x144",
            type: "image/png"
          },
          {
            src: "plenum_icon_152x152.png",
            sizes: "152x152",
            type: "image/png"
          },
          {
            src: "plenum_icon_192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "plenum_icon_384x384.png",
            sizes: "384x384",
            type: "image/png"
          },
          {
            src: "plenum_icon_512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],

  // Garantir compatibilidade com deploy (Vercel)
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
