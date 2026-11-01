id: vitest-config-defineconfig-source
type: anti-pattern
topic: general
perspective: the-coder
created: 1787920396.948915
---

Tried: `import { defineConfig } from 'vite'` in vite.config.ts while also passing a top-level `test: {...}` key for Vitest.
Failed because: plain Vite's UserConfig type doesn't know about the `test` field, so TS/lint on the config can be structurally wrong even if it runs.
Instead: `import { defineConfig } from 'vitest/config'` — it re-exports Vite's defineConfig merged with Vitest's config types, so a single vite.config.ts can hold both `plugins` and `test` with correct typing.