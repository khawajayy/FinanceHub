import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// `base` is the GitHub Pages sub-path (https://<user>.github.io/<repo>/).
// Override with VITE_BASE when hosting at a domain root.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/FinanceHub/",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: { manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore"], react: ["react", "react-dom", "react-router-dom"], motion: ["framer-motion"] } },
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
