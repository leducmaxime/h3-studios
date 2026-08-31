import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Permet de tester directement les modules de src/lib qui importent le
      // runtime Cloudflare, au lieu d'en recopier la logique dans les tests.
      "cloudflare:workers": path.resolve(__dirname, "./test/stubs/cloudflare-workers.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
