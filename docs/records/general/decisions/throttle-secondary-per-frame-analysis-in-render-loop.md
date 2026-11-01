id: throttle-secondary-per-frame-analysis-in-render-loop
type: pattern
topic: general
perspective: the-coder
created: 1787924432.170526
---

When a composition root's tick()/render loop already runs an expensive per-frame operation (e.g. an FFT inside an existing use-case) and a new feature needs a second, independent instance of that same class of computation (e.g. a separate FFT-based analyzer port for a diagnostic/heuristic feature), don't silently let it run unthrottled every frame. Either (a) throttle it to run every N frames with a documented frame-count modulo check when it's a heuristic/hint that doesn't need per-frame freshness (e.g. a crosstalk warning), while (b) letting a genuinely visual/live feature (e.g. a spectrum/equalizer display) run every frame but gated behind a visibility flag so the cost is zero when hidden. Document the reasoning for the throttle constant inline — it's a deliberate rAF-budget tradeoff, not an arbitrary number. Calling a shared cheap read (e.g. getFrame() on a buffer/AnalyserNode) more than once per tick for two independent consumers is fine and doesn't need deduplication — the cost lives in the downstream computation (FFT), not the read.