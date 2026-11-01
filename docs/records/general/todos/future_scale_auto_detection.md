id: future_scale_auto_detection
type: todo
topic: general
created: 1787920784.990307
---

User wants (post-MVP, not in the current 9-chunk plan): auto-detect which scale is loaded by having the player strike all tone fields once, rather than only manually picking a scale from known-scales.ts. Likely shape: a new use-case in scale-configuration/application (e.g. DetectScaleFromStrikes) that collects fundamental-frequency readings across a strike sequence, clusters/dedupes them into a candidate note set, then either matches against KNOWN_SCALES or constructs an ad-hoc Scale from the detected notes. Depends on tone-field-detection's per-strike fundamental output (Chunk 2) being available as a stream/sequence, not just a single live reading. Requested 2026-08-28, during Chunk 1-3 execution.