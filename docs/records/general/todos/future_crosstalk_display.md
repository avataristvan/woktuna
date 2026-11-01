id: future_crosstalk_display
type: todo
topic: general
created: 1787920784.990307
---

User wants (post-MVP, not in the current 9-chunk plan): the app should be able to show/flag crosstalk between neighboring tone fields. Research doc §2.5 already flags this as an open, unresolved question (no verified source on whether crosstalk depends on strike axis or mainly proximity to the shared ridge). Likely shape: a detection-side addition (tone-field-detection) that watches for unexpected energy at a frequency matching a *different* tone field's known fundamental while analyzing the current one, and a visualization-side addition (tone-field-visualization) to surface a 'possible crosstalk' warning. Needs the app to know all tone fields' target frequencies at once (ties into scale-configuration's active Scale), not just the one being tuned. Requested 2026-08-28, during Chunk 1-3 execution.