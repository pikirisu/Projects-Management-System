import { defineConfig } from "vitest/config";

/*
 * Separate from vite.config.ts on purpose. Vitest bundles its own copy of Vite,
 * so a single config that imported both `vitest/config` and the Vite 8 plugins
 * would type the plugin array against the wrong Vite and fail `tsc --noEmit`.
 *
 * Nothing here needs those plugins: esbuild picks up `jsx: "react-jsx"` from
 * tsconfig on its own, and Tailwind classes are never asserted on in jsdom.
 * Vitest reads this file in place of vite.config.ts, not in addition to it.
 */
export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        css: false,
    },
});
