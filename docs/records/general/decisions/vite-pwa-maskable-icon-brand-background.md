id: vite-pwa-maskable-icon-brand-background
type: pattern
topic: general
perspective: the-coder
created: 1787923945.377292
---

Pattern: `@vite-pwa/assets-generator`'s `minimalPreset` defaults maskable/apple icon backgrounds to white with 0.3 padding — looks jarring against a dark-themed app's manifest `background_color`/`theme_color`. Override per-asset in the config passed via `-c`: spread `minimalPreset` then override `maskable: { sizes: [512], padding: 0.25, resizeOptions: { fit: 'contain', background: '<brand-bg-hex>' } }` (0.25 still comfortably clears Android's ~20% minimum adaptive-icon safe zone) and similarly for `apple`. Also worth setting `transparent.padding: 0` when the source SVG already bakes in its own rounded-corner/background treatment, to avoid a redundant transparent letterbox margin around it.