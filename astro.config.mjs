// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

import sitemap from "@astrojs/sitemap";

import svelte from "@astrojs/svelte";

// https://astro.build/config
export default defineConfig({
  output: "server",
  site: "https://timeline.smiling.dev",

  adapter: cloudflare({
    sessionKVBindingName: "SESSION",
  }),

  integrations: [
    sitemap({
      filter: (page) => {
        return !page.includes("/admin");
      },
    }),
    svelte(),
  ],

  vite: {
    build: {
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          experimentalMinChunkSize: 3000,
        },
      },
    },
    ssr: {
      noExternal: ["svelte"],
    },
  },

  experimental: {
    rustCompiler: true,
  }
});
