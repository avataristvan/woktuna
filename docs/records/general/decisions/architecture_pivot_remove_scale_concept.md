id: architecture_pivot_remove_scale_concept
type: domain
topic: general
created: 1787929928.721818
---

User decided (2026-08-28, after live-testing) to remove the entire 'Scale' concept from the app: scale selection/matching wasn't helpful in practice, focus should be on whatever tone field is currently being played, resolved chromatically (nearest equal-tempered semitone via frequencyToNote/noteToFrequency) rather than matched against a named scale's note list. Confirmed scope: remove Scale type, KNOWN_SCALES data, the scale-inference capability (auto-detect scale from strikes) entirely, and the crosstalk-detection capability entirely (crosstalk had no other basis to check against once there's no 'other notes in my instrument' concept). Keep: reference pitch (440/443Hz still user-adjustable), FFT tolerance-cents control, hammer-mode inside/outside toggle, sticky target-note lock (adapted to work chromatically instead of per-scale), spectrum/equalizer view (unrelated, stays).