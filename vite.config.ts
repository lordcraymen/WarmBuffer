import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "WarmBuffer",
      fileName: "warmbuffer",
    },
    rollupOptions: {
      external: [],
    },
  },
  plugins: [
    dts({
      include: ["src"],
      rollupTypes: true,
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
    },
  },
});
