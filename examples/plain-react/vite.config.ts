import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Pull DndListNative directly from the parent package's src so we
      // dogfood it without a publish step.
      "xmlui-dnd-list/native": path.resolve(__dirname, "../../src/DndListNative.tsx"),
    },
  },
  server: {
    port: 5180,
  },
});
