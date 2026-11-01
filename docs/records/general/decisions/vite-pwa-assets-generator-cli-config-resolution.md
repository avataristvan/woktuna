id: vite-pwa-assets-generator-cli-config-resolution
type: anti-pattern
topic: general
perspective: the-coder
created: 1787923945.377292
---

Tried: running `npx @vite-pwa/assets-generator -c pwa-assets.config.mjs` (config uses `import { defineConfig, minimalPreset } from '@vite-pwa/assets-generator/config'`) directly in a scratch directory with no local node_modules.
Failed because: the config file is loaded via jiti/unconfig using Node's own module resolution, which needs `@vite-pwa/assets-generator` reachable from that directory's node_modules — a plain npx-cached global install isn't enough for the config file's own `require`/`import` of the package.
Instead: `npm init -y && npm install --no-save @vite-pwa/assets-generator@<version>` in the scratch dir first, then run the local CLI bin directly (`npx --no-install pwa-assets-generator -c pwa-assets.config.mjs`). This resolves cleanly since the config file sits next to a real node_modules.