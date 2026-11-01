id: canvas-renderer-never-skip-drawing-for-good-state
type: anti-pattern
topic: general
perspective: the-coder
created: 1787927107.626506
---

Anti-pattern: a Canvas renderer method used an early `return` for the "good/nominal" state of a severity-style enum (e.g. `if (status === 'ok') return` before drawing anything), reasoning that the neutral case needs no visual treatment. In practice this makes the UI's *only* live feedback vanish exactly when the underlying signal is doing well, which reads as a rendering bug ("the indicator disappeared") rather than positive feedback. Fix: every state of the enum must produce a draw call, even if it's a small/minimal one - the neutral/good state gets its own distinct visual (different size/opacity/style, not just a scaled-down version of another state's shape) rather than nothing. General rule for any live status renderer (canvas, LED-style indicators, progress UI): audit every early-return branch and ask whether it's skipping *all* rendering for a valid state, not just skipping an optional overlay.