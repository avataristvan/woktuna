id: domain_pitch_direction_vs_hammer_position_2026_09_28
type: domain
topic: general
created: 1790632545.368635
---

Decision: The UI shows two separate facts per tone field. Pitch direction (too high/too low, the +/- glyph and the tuner meter) comes only from the sign of the cent deviation. Hammer position (center/edge zone) comes from hammerBias and depends on the mode.
Why: The user's core need is to see at a glance whether the fundamental, octave and fifth are each too high or too low. Before this, the glyph was derived from hammerBias, so it showed the wrong direction in inside mode. The per-partial tuner panel (Fundamental/Octave/Fifth rows) is now the primary view, and the oval is secondary hammer guidance.
Scope: WokTuna tone-field-visualization (partial-meter.ts deviationDirection, canvas-tone-field-renderer, tuner-panel-view). Delivered 2026-09-28 in UI/UX chunks 1-5.