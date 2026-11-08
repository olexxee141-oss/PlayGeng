import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  envDir: repositoryRoot,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
