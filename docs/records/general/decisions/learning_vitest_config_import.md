id: learning_vitest_config_import
type: pattern
topic: general
created: 1787920470.890174
---

Vitest config folded into vite.config.ts must import `defineConfig` from `vitest/config` (not plain `vite`) for the `test` field to type-check correctly under `tsc`.