# Decision Records Index

| id | topic | type | title | status |
|---|---|---|---|---|
| anti-pattern_stale_dev_service_worker_2026_10_04 | general | pattern | Rule: Register the service worker in production only and actively unregister it  | active |
| architecture_pivot_remove_scale_concept | general | domain | User decided (2026-08-28, after live-testing) to remove the entire 'Scale' conce | active |
| architecture_pivot_remove_scale_concept_complete | general | learning | Architecture pivot (remove Scale concept) complete, committed as 4cad24f. scale- | active |
| audio-fft-to-bars-downsampling | general | pattern | Feedback: downsampling a raw FFT magnitude spectrum into a small bar-chart/equal | active |
| canvas-renderer-never-skip-drawing-for-good-state | general | anti-pattern | Anti-pattern: a Canvas renderer method used an early `return` for the "good/nomi | active |
| chunk-1-scaffold-complete | general | learning | Chunk 1 (bare scaffold) complete, committed as 25f246a. Vite+TS vanilla-ts templ | active |
| chunk-2-tone-field-detection-complete | general | learning | Chunk 2 (tone-field-detection capability, fundamental-only) complete, committed  | active |
| chunk-3-scale-configuration-complete | general | learning | Chunk 3 (scale-configuration capability) implemented in worktree agent-acc4fad35 | active |
| chunk-5-integration-complete | general | learning | Chunk 5 (wire live fundamental into radial guidance) complete, committed directl | active |
| chunk-5.5-review-fixes-complete | general | learning | Chunk 5.5 (review-driven fix pass on Chunks 2-4) complete, committed to master a | active |
| chunk-6-partial-detection-complete | general | learning | Chunk 6 (octave + compound-fifth FFT peak-picking, the highest-risk chunk) compl | active |
| chunk-6.5-review-fixes-complete | general | learning | Chunk 6.5 (review-driven fix pass on Chunk 6) complete, committed to master as e | active |
| chunk-7-axis-markers-complete | general | learning | Chunk 7 (wire axis markers to partial deviations) complete, committed to master  | active |
| chunk-8-hammer-toggle-complete | general | learning | Chunk 8 (inside/outside hammer toggle) complete in worktree agent-a88ff1191a56d3 | active |
| chunk-d-spectrum-analyzer-extraction-complete | general | learning | Chunk D (prerequisite for crosstalk display + spectrum/equalizer view, post-MVP) | active |
| chunk_reference_pitch_ui_wiring | general | learning | Reference-pitch UI wiring chunk complete (commit 4bfec54), directly analogous in | active |
| chunk_sticky_target_lock_selectscale | general | learning | Sticky target-note lock added to SelectScale (application/select-scale.ts, commi | active |
| chunk_tolerance_cents_ui_wiring | general | learning | FFT partial search tolerance UI wiring chunk complete (commit 8902cf6), directly | active |
| ddd-capability-boundary-duplicate-pure-helper | general | pattern | Feedback: when a capability-centric DDD plan explicitly forbids cross-capability | active |
| ddd-outer-layer-reexports-domain-type-not-duplicates | general | pattern | Feedback: in capability-centric DDD, when an outer-layer composition-root file ( | active |
| defer-browser-api-construction-for-jsdom-testable-composition-root | general | pattern | Pattern: in a composition root (bootstrap.ts style) that wires domain/applicatio | active |
| domain_pitch_direction_vs_hammer_position_2026_09_28 | general | domain | Decision: The UI shows two separate facts per tone field. Pitch direction (too h | active |
| domain_woktuna_capability_ddd_architecture_2026_10_04 | general | domain | Decision: WokTuna uses capability-centric DDD + clean architecture (src/capabili | active |
| dpr-change-matchmedia-self-rearm | general | pattern | Pattern: matchMedia(`(resolution: ${dpr}dppx)`) is a self-re-arming devicePixelR | active |
| dsp-decouple-analysis-window-from-buffer-size | general | pattern | Pattern: When capping a correlation/analysis window size for performance (autoco | active |
| dsp-peak-noise-gate-relative-to-known-anchor | general | pattern | Rule: When gating a spectral/correlation peak as 'genuine signal vs. noise/leaka | active |
| future_crosstalk_display | general | todo | User wants (post-MVP, not in the current 9-chunk plan): the app should be able t | active |
| future_scale_auto_detection | general | todo | User wants (post-MVP, not in the current 9-chunk plan): auto-detect which scale  | active |
| future_spectrum_equalizer_view | general | todo | User wants (post-MVP, not in the current 9-chunk plan): an equalizer/spectrum vi | active |
| learning_handpan_tuner_market_gap_2026_10_04 | general | learning | Observed: No existing handpan tuner app (Linotune, TonalEnergy, Spectroid) shows | active |
| learning_scaffold_into_scratch_dir | general | pattern | When scaffolding a Vite project into a non-empty target directory that already h | active |
| learning_tsconfig_erasable_syntax_only | general | pattern | This project's tsconfig.json has `erasableSyntaxOnly: true`, which rejects TypeS | active |
| learning_typed_array_buffer_pinning | general | pattern | When a class field holds a Float32Array that gets passed into Web Audio APIs lik | active |
| learning_vitest_config_import | general | pattern | Vitest config folded into vite.config.ts must import `defineConfig` from `vitest | active |
| learning_worktree_cwd_isolation | general | pattern | When a the-coder agent runs in isolation:"worktree" mode, the task prompt's stat | active |
| pattern_explicit_todos_for_unknowns_2026_10_04 | general | pattern | Rule: Keep known open items as explicit TODOs, not silently resolved (e.g. refer | active |
| pattern_prettierignore_cited_docs | general | pattern | Rule: Before the first `prettier --write` (or any auto-formatter) run in a repo, | active |
| review_findings_chunk_6 | general | learning | Review of Chunk 6 (5396826) found: CRITICAL - fft-peak-picking.ts's `referenceMa | active |
| review_findings_chunks_2_4 | general | learning | Code review of merged Chunks 2-4 found: CRITICAL - autocorrelation.ts is O(frame | active |
| shared-fft-analyzer-two-consumers-deletion-trap | general | anti-pattern | Tried: deleting a feature (crosstalk-detection) that happened to share an FFT/sp | active |
| shared-kernel-promotion-avoid-backward-import | general | pattern | When promoting a pure constant/helper from a capability's domain layer into a sh | active |
| sticky-lock-hysteresis-for-flickering-discrete-resolution | general | pattern | Pattern: "sticky lock" / hysteresis fix for a live-sensor-driven UI value that f | active |
| test-synthetic-spectrum-bin-resolution-must-fit-tolerance-band | general | anti-pattern | Tried: unit-testing a band-limited spectral peak search (find the strongest bin  | active |
| the-coder_check_render_loop_before_rehook | general | pattern | Rule: When wiring a new live-reactive UI parameter into an app with an existing  | active |
| throttle-secondary-per-frame-analysis-in-render-loop | general | pattern | When a composition root's tick()/render loop already runs an expensive per-frame | active |
| todo_live_smoke_test | general | todo | TODO: Human needs to do a live smoke test with a real microphone (ideally an act | active |
| todo_tune_crosstalk_tolerance | general | todo | TODO: After real-hardware testing, re-tune CROSSTALK_CHECK_INTERVAL_FRAMES (cros | active |
| ts-erasable-syntax-only-blocks-parameter-properties | general | anti-pattern | Tried: constructor parameter-property shorthand (`constructor(private readonly x | active |
| ts-erasable-syntax-only-no-parameter-properties | general | anti-pattern | Tried: writing TypeScript constructor parameter properties (`constructor(private | active |
| ts-extract-shared-computation-dual-precision-boundary | general | pattern | Pattern: to expose an internally-computed intermediate result (e.g. a spectrum/F | active |
| ts-float32array-arraybuffer-generic-dom-apis | general | anti-pattern | Tried: `private buffer: Float32Array | null = null` later filled via `new Float3 | active |
| ts-readonly-propagation-interface-mismatch | general | anti-pattern | Anti-pattern: marking a const `as const` / a field `readonly` on a data array is | active |
| vite-pwa-assets-generator-cli-config-resolution | general | anti-pattern | Tried: running `npx @vite-pwa/assets-generator -c pwa-assets.config.mjs` (config | active |
| vite-pwa-maskable-icon-brand-background | general | pattern | Pattern: `@vite-pwa/assets-generator`'s `minimalPreset` defaults maskable/apple  | active |
| vite-scaffold-into-nonempty-dir | general | anti-pattern | Tried: `npm create vite@latest . -- --template <t>` directly in a non-empty targ | active |
| vitest-config-defineconfig-source | general | anti-pattern | Tried: `import { defineConfig } from 'vite'` in vite.config.ts while also passin | active |
