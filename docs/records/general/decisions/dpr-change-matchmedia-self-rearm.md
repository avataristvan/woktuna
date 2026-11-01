id: dpr-change-matchmedia-self-rearm
type: pattern
topic: general
perspective: the-coder
created: 1787921660.491321
---

Pattern: matchMedia(`(resolution: ${dpr}dppx)`) is a self-re-arming devicePixelRatio-change listener -- it fires exactly once when the current dpr stops matching, so the handler must call the same setup function again (re-read window.devicePixelRatio, create a fresh matchMedia query, re-attach the listener) to catch the *next* change. A ResizeObserver alone misses DPI changes that don't resize the element (browser zoom, dragging a window to a different-DPI monitor), so canvas/pixel-density code needs both listeners, and both must be torn down in dispose()/cleanup.
When: Any Canvas/WebGL renderer that manually manages backing-store resolution vs. CSS size (devicePixelRatio scaling) and needs to stay correct across zoom/monitor changes, not just element resizes.