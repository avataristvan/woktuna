id: future_spectrum_equalizer_view
type: todo
topic: general
created: 1787920823.145194
---

User wants (post-MVP, not in the current 9-chunk plan): an equalizer/spectrum view so the player can visually verify a strike excites the overtones (octave, compound fifth) cleanly, not just see the tuning-guidance oval. Similar in spirit to what Spectroid (a competitor app, see research doc §1) already provides as a raw real-time FFT spectrum display. Likely shape: a new presentation-layer view in tone-field-visualization (or a sibling small capability) that renders the live frequency spectrum/magnitude bars from tone-field-detection's raw FFT data (available once Chunk 6's fft-peak-picking.ts exists) -- separate from the guidance oval, more of a diagnostic/debug aid for checking strike technique than a tuning target itself. Requested 2026-08-28, during Chunk 1-3 execution, alongside future_scale_auto_detection and future_crosstalk_display.