import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "server/index": "src/server.ts",
    "next/index": "src/next.ts",
    "postgres/index": "src/postgres.ts",
    "browser/index": "src/browser.ts",
    "react/index": "src/react.tsx",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2020",
  external: ["react"],
});
