// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: "server",
  site: "https://timeline.smiling.dev",

  adapter: cloudflare({
    sessionKVBindingName: 'SESSION',
  }),

  integrations: [sitemap({
    filter: (page) => {
      // Exclude admin and login pages from sitemap
      return !page.includes("/admin")
    }
  })]
});