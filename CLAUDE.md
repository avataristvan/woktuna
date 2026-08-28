# CLAUDE.md

## Overview

WokTuna is an installable PWA that guides tuning a handpan (a dished metal
percussion instrument): for each oval tone field it shows _where_ to hammer
(center↔edge) and _along which axis_ (long=octave, short=compound-fifth),
based on live multi-partial pitch detection from the microphone. Domain
knowledge source: `handpan-stimm-app-recherche.md` (German) at repo root.
Full architecture/build plan: `~/.claude/plans/rippling-hugging-raven.md` (local, not part of this repo).

## Commands

```
npm run dev         # Vite dev server
npm run build        # tsc --noEmit + vite build
npm run preview      # serve the production build
npm run lint          # eslint .
npm run format        # prettier --write .
npm run test          # vitest run
npm run typecheck     # tsc --noEmit
```

## Architecture

Capability-centric DDD, dependencies point inward:

```
domain/ ← application/ ← infrastructure/(presentation/) ← ui
```

```
src/
  app/                # composition root: wires infra adapters → use-cases → presentation
  shared-kernel/       # vocabulary shared across capabilities (PartialKind, axis mapping, etc.)
  capabilities/
    scale-configuration/     # note/frequency conversion, nearest-target lookup
    tone-field-detection/    # autocorrelation (fundamental) + FFT peak-picking (octave/fifth)
    tone-field-visualization/ # deviation → guidance mapping, Canvas renderer
```

Each capability is layered `domain → application → infrastructure/presentation`.
`domain/` has zero Web Audio/Canvas/DOM dependency — that's what makes the
tuning-rule logic unit-testable, and it's the actual differentiating IP of
this app. Capabilities stay decoupled from each other's domains; composition
happens in `app/`.

As of Chunk 1, `src/app/`, `src/shared-kernel/`, `src/capabilities/` are
empty scaffolding (`.gitkeep` only) — real logic lands starting Chunk 2.

## Domain knowledge pointers

Each handpan tone field resonates at 3 partials simultaneously: fundamental
(center/dimple), octave (long axis), compound fifth (short axis). Hammering
near center raises pitch, near the edge lowers it (research doc §2.1–2.4).
Inside/outside hammering inversion (§2.3) is inferred from a single source
and unverified — kept as an isolated, explicitly-flagged function
(`hammer-direction.ts`, from Chunk 8) rather than baked into rendering.

## Known unknowns (do not silently harden into false precision)

- Reference pitch for scale frequencies (A4=440 vs 443 vs other) — must stay
  a configurable parameter, no default confirmed yet.
- `known-scales.ts` (Chunk 3+) ships placeholder scale data — needs user
  verification against a trusted source before real tuning use.
- FFT tolerance window for octave/fifth search (`DEFAULT_TOLERANCE_CENTS` in
  `fft-peak-picking.ts`, implemented Chunk 6 at ±250 cents) — likely needs
  tuning after real-hardware testing; see the Chunk 6 DSP gotcha below for
  the narrow-vs-wide tradeoff.
- No existing source confirms the exact crosstalk-axis relationship or
  strike-path diagram (research doc §5) — the whole detection pipeline needs
  real-hardware validation before being trusted for actual tuning.

## DSP gotchas (Chunk D: shared FFT extraction / SpectrumAnalyzer port)

- The FFT/windowing/magnitude-computation core that used to live privately
  inside `fft-peak-picking.ts` is now `infrastructure/dsp/fft.ts`:
  `computeMagnitudeSpectrumF64(frame, fftSize)` (Float64Array, same
  signature/behavior as the old private function) is what
  `fft-peak-picking.ts` calls internally — its noise-floor gating logic
  (Chunk 6.5) was **not** touched and still operates on identical Float64
  precision. `computeMagnitudeSpectrum(frame, sampleRate, fftSize?)` is the
  new public entry point (returns `{ magnitudes: Float32Array, binToHz,
  hzToBin }`), exposed via the new `SpectrumAnalyzer` port
  (`application/ports.ts`) and its `FftSpectrumAnalyzer` adapter
  (`infrastructure/spectrum-analyzer.ts`). Both paths share the exact same
  `fft()`/windowing code — don't let a future change reintroduce a second
  FFT implementation for either.
- `computeMagnitudeSpectrum`'s public Float32Array is a final cast of the
  internal Float64Array result, not a separately-computed spectrum — this
  is safe because comparisons downstream (peak-picking's margin/ratio gates)
  have headroom orders of magnitude larger than float32 precision loss.
- This chunk was scoped as a prerequisite for two later post-MVP features
  (crosstalk display, spectrum/equalizer view) — `SpectrumAnalyzer` isn't
  wired into `app/bootstrap.ts` yet, only the port + adapter exist.

## DSP gotchas (Chunk 6: octave/compound-fifth FFT peak-picking)

- `fft-peak-picking.ts` computes its own FFT over the full frame (up to
  `DEFAULT_FFT_SIZE` in `web-audio-microphone-source.ts`, truncated down to
  the largest power of 2 that fits) — this is deliberately a *different*
  window than `autocorrelation.ts`'s 4096-sample
  `CORRELATION_WINDOW_SAMPLES`. The large window is exactly why that buffer
  is sized the way it is (see the Chunk 5.5 gotcha below); FFT bin
  resolution needs it, autocorrelation doesn't. Don't let a future refactor
  try to make these two DSP files share one window length.
- The octave/compound-fifth search-band tolerance (`DEFAULT_TOLERANCE_CENTS`
  in `fft-peak-picking.ts`, currently ±250 cents) is an explicit TODO/tunable,
  not a settled value — too narrow misses badly-detuned partials (the whole
  point of a *pre*-tuning app), too wide risks locking onto crosstalk from a
  neighboring tone field (research doc §2.5's open, unresolved question).
  Needs real-hardware validation before treating as final.
- `AnalyzeToneField`'s constructor takes an `AnalyzeToneFieldOptions` object
  now (`{ smoothingWindow?, partialDetector? }`), not a positional
  `smoothingWindow` third argument — this changed in Chunk 6 when a fourth
  dependency (`PartialDetector`) was added.

## DSP gotchas (Chunk 6.5: review fix pass on Chunk 6's peak-picking)

- The peak-vs-noise gate in `fft-peak-picking.ts` was redesigned. The old
  design (a bare `referenceMagnitude <= 0` check, plus requiring a candidate
  ≥5% of the fundamental's own magnitude) had two real bugs: the `<= 0`
  check was dead code (`Math.hypot` over FFT bins is essentially never
  exactly zero for real/noisy input, only for literal silence), so a
  pure-noise frame with no tone at all sailed through and produced confident
  false-positive octave/fifth readings; and the 5% ratio caused false
  negatives on real quiet partials, contradicting the domain doc's own
  description of tapping an axis specifically *to isolate* a partial that
  usually is not comparable in magnitude to the fundamental
  (`handpan-stimm-app-recherche.md` §2.1).
- The new primary discriminator is `isGenuineSpectralPeak` +
  `localNoiseFloor`: a candidate's winning bin must be a local maximum AND
  clear `NOISE_FLOOR_MARGIN` (6x) times the median magnitude of bins just
  outside its own search band (`FLOOR_SAMPLE_EXTRA_BINS`=6 bins beyond the
  band edges — deliberately excludes the *entire* band, not just the
  winning bin, because a narrow band like the ±50-cent fundamental
  reference can be entirely occupied by one real peak's Hann main lobe).
  `MIN_PARTIAL_TO_FUNDAMENTAL_RATIO` still exists but is now a low secondary
  sanity floor (2%), not the primary gate. A global/spectrum-wide noise
  floor was tried in Chunk 6 and rejected (see git history) — still
  rejected here for the same reason: most of a mostly-silent synthetic
  spectrum sits at exactly zero, so it clears trivially. A literally-silent
  frame (all-zero magnitude) needs its own explicit `peakMag <= 0` guard
  before the margin check, since `0 >= margin * 0` is trivially true.
- `DEFAULT_FFT_SIZE` in `web-audio-microphone-source.ts` was halved from
  32768 to 16384 (measured ~2.9ms → ~1.3ms per `fft-peak-picking.ts` call)
  as a safety margin against the combined autocorrelation+FFT cost eating
  the 16.7ms rAF budget on real (unmeasured) mobile hardware. Verified safe
  against the low-fundamental edge case (a ~110Hz fundamental with a 16384
  window makes the ±50-cent reference band collapse to as few as 2 bins) via
  a dedicated test in `fft-peak-picking.spec.ts`. **4096 was NOT verified
  safe** — do not assume it is without re-running that same edge-case check.

## DSP gotchas (Chunk 5.5 fix pass)

- `autocorrelation.ts`'s correlation window (`CORRELATION_WINDOW_SAMPLES`,
  currently 4096) is deliberately decoupled from the full AnalyserNode frame
  length (`DEFAULT_FFT_SIZE`, 32768 in `web-audio-microphone-source.ts`).
  The larger buffer exists for Chunk 6's FFT bin resolution, not for
  autocorrelation accuracy — accuracy there comes from parabolic
  interpolation on the winning lag, not window length. Don't let Chunk 6
  quietly widen the correlation window back to the full frame length; that
  reintroduces a ~9x rAF-budget overrun (measured ~158ms/frame at 32768
  samples vs. ~5.7ms at 4096).
- The same file applies DC-removal + a one-pole ~60Hz high-pass
  (`removeDcAndRumble`) before correlating. Any Chunk 6 refactor of this
  function must keep that preprocessing (or move it somewhere still applied
  before every correlation), otherwise low-frequency rumble goes back to
  producing a confidently wrong pitch instead of a null.
- `canvas-tone-field-renderer.ts` needs both a `ResizeObserver` (element
  size changes) and a self-re-arming `matchMedia((resolution: ${dpr}dppx))`
  listener (browser zoom / different-DPI monitor, which don't resize the
  element) to stay correctly scaled — both must be disconnected in
  `dispose()`.

## DSP/domain gotchas (Chunk 7: axis markers wired to partial deviations)

- `shared-kernel/partial-kind.ts` now holds the canonical `PartialKind`/`Axis`
  vocabulary and the octave (2x)/compound-fifth (3x) ratio constants used by
  `tone-field-visualization`. It deliberately **duplicates** (does not
  import) `tone-field-detection/domain/tuning-rules.ts`'s
  `expectedPartialRatio` — shared-kernel sits below capabilities in the
  dependency graph, so importing a capability's domain module from
  shared-kernel would invert that direction. `tone-field-detection` was left
  untouched (its own local `PartialKind`/`expectedPartialRatio` still exist
  independently) — reconciling the two was explicitly out of this chunk's
  scope. Keep the ratio constants in sync by hand if they ever change.
- `deviation-to-guidance.ts`'s `deviationToGuidance` now takes two additional
  optional params (`octaveCentDeviation`, `compoundFifthCentDeviation`,
  default `null`) mapped to `longAxis`/`shortAxis` via
  `shared-kernel/partial-kind.ts`'s `axisForPartial`. `null` means "no
  reading" (detector found no clear peak) and must stay `null`, not become a
  fabricated zero-deviation "in tune" axis reading.
- `build-guidance.ts` derives octave/fifth *target* frequencies from the
  fundamental's target × the shared-kernel ratio (`targetHz * 2`,
  `targetHz * 3`) — it does not do a second scale lookup. A tone field's
  partials are expected at fixed ratios above its own fundamental, not
  independent scale notes.

## DSP/domain gotchas (Chunk 8: inside/outside hammer toggle)

- `hammer-direction.ts` (new domain file) owns both the `HammerMode` type
  (`'outside' | 'inside'`) and `resolveHammerBias(centDeviation, severity,
  mode)`, which replaces `deviation-to-guidance.ts`'s old inline `< 0 ?
  'center' : 'edge'` ternary. `deviationToGuidance` now takes a 4th optional
  `hammerMode` param (default `'outside'`) and delegates the center/edge
  decision to this function instead of deciding it itself.
- `HammerMode` is defined in the domain layer (`hammer-direction.ts`), not
  in `src/app/app-state.ts` — `app-state.ts` re-exports the type via
  `export type { HammerMode }` rather than declaring its own. `app/` is the
  outermost layer (composition root), so it importing a capability's domain
  type is the correct direction; the reverse (domain importing from `app/`)
  would not be.
- The inside-mode inversion is **only** applied to the fundamental's
  center/edge (`hammerBias`) — `longAxis`/`shortAxis` (octave/compound-fifth
  axis markers) are untouched by hammer mode. Research doc §2.3 only claims
  an inversion for center/edge hammering; it makes no axis-inversion claim,
  so don't invent one.
- `AppState.setHammerMode(mode)` is the setter; `bootstrap.ts`'s render loop
  reads `appState.hammerMode` fresh every tick (not cached) and passes it as
  `buildGuidance`'s 3rd arg, so the toggle takes effect on the very next
  frame with no explicit re-render call needed.
- UI toggle in `main.ts` is a `<fieldset class="hammer-mode">` with two
  radio inputs (`name="hammer-mode"`, values `"outside"`/`"inside"`,
  outside checked by default) — deliberately not a `<select>` like the
  scale picker, since a binary either/or reads better as a two-way switch.

## DSP/domain gotchas (Chunk I: final integration of scale-inference,
crosstalk-detection, spectrum view)

- `src/app/bootstrap.ts` now also owns: (1) a scale auto-detection flow
  (`startScaleDetection()`/`finishScaleDetection()`, backed by
  `DetectScaleFromStrikes` — a *fresh instance* per detection session, not a
  reused/reset one, since the capability exposes no reset method and
  recreating it is simpler than adding one), (2) a throttled crosstalk check
  (`CheckCrosstalk`, via `CROSSTALK_CHECK_INTERVAL_FRAMES = 15`), and (3) an
  optional spectrum/equalizer panel (`SpectrumViewRenderer`, fed by
  `FftSpectrumAnalyzer`).
- `DetectScaleFromStrikes` (application layer) gained one small addition,
  `getCollectedCount()` — a thin wrapper around
  `StrikeCollector.getCollectedFrequencies().length` — purely for live "N
  notes collected" UI feedback while a detection session is in progress. No
  domain logic changed.
- The crosstalk check runs its **own** FFT (`SpectrumAnalyzer.analyzeSpectrum`
  inside `CheckCrosstalk.check()`) — separate from `FftPartialDetector`'s
  internal one already run every tick by `analyzeToneField.analyze()`. Doing
  that every frame would double the per-frame FFT cost for what's explicitly
  a heuristic hint, so it's throttled to every 15 frames (~4/sec at 60fps).
  The spectrum panel's own `analyzeSpectrum` call runs every tick *only*
  while the panel is visible (`showSpectrum` flag) — no FFT cost paid when
  it's hidden, and this is a genuinely independent FFT call from the
  crosstalk one (not deduplicated/shared) since `CheckCrosstalk.check()`
  computes its own spectrum internally and wasn't touched.
  `microphoneSource.getFrame()` itself (a cheap buffer read, not the FFT) can
  be called more than once per tick when both features are due in the same
  frame — harmless, same buffer object, no extra mic I/O.
- `SpectrumViewRenderer` is constructed lazily inside `setSpectrumVisible()`
  (only on first `true`), same jsdom-compatibility reason as
  `CanvasToneFieldRenderer` being constructed lazily inside `start()` — see
  the doc comment on `bootstrap()`.
- Crosstalk warning copy in `describeCrosstalkWarnings()` (bootstrap.ts) says
  "Possible crosstalk from: …", never "detected" — matches the hedging
  language `crosstalk-warning.ts` and `detect-crosstalk.ts` already commit to
  for research doc §2.5's unresolved question.
- New UI in `src/main.ts`: `#crosstalk-readout` (updated by bootstrap's tick
  loop), a `#detect-scale-button`/`#scale-detection-readout` pair (button
  toggles "Detect scale from strikes" ↔ "Finish detecting"; on finish, if the
  result is a known scale it's selected in the existing `<select>`, if it's
  the ad-hoc fallback a `Custom (detected)` option is added and selected),
  and a `#spectrum-toggle` checkbox + `#spectrum-canvas` (hidden by default
  via the `hidden` attribute, toggled alongside `setSpectrumVisible()`). The
  detect-scale button starts `disabled` and is only enabled after `start()`
  resolves — scale detection depends on the same live tick loop as the main
  tuning view.

## DSP/domain gotchas (reference-pitch UI wiring — post-Chunk-I)

- `SelectScale.getReferencePitchHz()`/`setReferencePitchHz()` existed and
  were already threaded into `bootstrap.ts` (crosstalk check,
  `finishScaleDetection`'s `inferScale` call) before the UI control existed
  — the only gap was exposing a way to change it. `ToneFieldApp` gained
  `setReferencePitchHz(hz: number): void`, a thin passthrough to
  `selectScale.setReferencePitchHz(hz)`. No explicit re-render call is
  needed: `tick()` already calls `selectScale.nearestTargetFor()` fresh
  every frame and reads `referencePitchHz` live, so a mid-session pitch
  change takes effect on the very next rAF frame — same pattern as the
  Chunk 8 hammer-mode toggle.
- UI in `src/main.ts`: `#reference-pitch-input` (`<input type="number">`,
  min=400/max=480/step=0.1, default 440) plus a `#reference-pitch-presets`
  `<datalist>` suggesting 440/442/443Hz. The presets are offered as common
  reference points, not asserted as a confirmed standard — matches this
  repo's stance (see "Known unknowns" above) that no single reference pitch
  is verified correct for handpans, only that it must stay configurable.
  Invalid/out-of-range input on `change` reverts the field to the last
  accepted value (`lastValidReferencePitchHz`, a closure var — not
  hardcoded back to 440) rather than passing nonsense through to
  `SelectScale`.
- `UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ` in `select-scale.ts` is now
  documented as a *starting* value overridable via this UI, not a fixed
  unconfigurable placeholder — its value (440) and `SelectScale`'s behavior
  were not changed.
- Pure UI-wiring chunk: `infrastructure/browser`/`app/`/presentation-layer
  scope only, no domain/application logic touched, no new tests added (per
  this repo's testing convention — see "Testing conventions" below). All
  129 existing tests still pass.

## PWA policy

The service worker must only register in production. `vite-plugin-pwa`'s
`devOptions.enabled` stays at its default `false` — a stale dev-mode SW
causes confusing "my change isn't showing up" symptoms (seen in an earlier
project). Don't flip this on
without adding an explicit dev-mode `unregister()` fallback.

The dev-mode `unregister()` fallback (deferred from Chunk 9, which couldn't
touch `main.ts`) was added in Chunk I: `src/main.ts` guards
`navigator.serviceWorker.getRegistrations().then(...)` behind both
`import.meta.env.DEV` and `'serviceWorker' in navigator` — the latter check
matters because jsdom's `navigator` has no `serviceWorker` property, so
`main.spec.ts`'s `await import('./main')` needs it to stay a no-op under
test rather than throwing.

## Icons (Chunk 9)

`public/icons/icon.svg` is the source icon — a simple abstract motif (dark
rounded-square background, an oval "tone field" split by a crosshair with a
center dimple) evoking the handpan tone-field/axis concept described in
`handpan-stimm-app-recherche.md`. It's a placeholder-but-real icon, not
final branding.

All other files in `public/icons/` (`icon-64.png`, `icon-192.png`,
`icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png`,
`favicon.ico`) are generated from `icon.svg` via `@vite-pwa/assets-generator`
(devDependency, pinned `1.0.2`) — do not hand-edit them, regenerate from the
source SVG instead. The maskable variant uses 0.25 padding with the brand's
`#1a1a1a` background (not the tool's default white) so it reads correctly
inside Android's adaptive-icon circular mask. The manifest's `icons` array
in `vite.config.ts` must list all five raster/vector entries with matching
`sizes`, including the one `purpose: "maskable"` entry — the Chunk 1
placeholder set was missing the maskable icon and the manifest `id` field;
both are now present (`id: '/'`).

To regenerate after changing `icon.svg`: there's no checked-in
`pwa-assets.config.mjs` (keeping this chunk's file-touch scope minimal) —
run `npx @vite-pwa/assets-generator@1.0.2` with an inline config that
overrides `minimalPreset`'s `maskable`/`apple` `resizeOptions.background`
to `'#1a1a1a'` (default is white, which looks wrong against this app's dark
theme) and `transparent.padding` to `0` (edge-to-edge, since `icon.svg`
already bakes in its own rounded-corner background). Copy the generated
`pwa-64x64.png` → `icon-64.png`, `pwa-192x192.png` → `icon-192.png`,
`pwa-512x512.png` → `icon-512.png`, `maskable-icon-512x512.png` →
`icon-maskable-512.png`, `apple-touch-icon-180x180.png` →
`apple-touch-icon-180.png`, `favicon.ico` as-is.

**Verified statically (Chunk 9):** `npm run build` succeeds;
`dist/manifest.webmanifest`'s icon `sizes` match each PNG's actual
dimensions (checked via `file`); all declared icon files exist in
`dist/icons/`. **Not verifiable without a real browser** — a human/future
chunk needs to check with an actual Lighthouse panel: the installability
prompt fires, the "Add to Home Screen" flow produces a correctly-masked
adaptive icon on Android, and offline behavior after first load.

## Testing conventions

- `domain/` and `infrastructure/dsp/` files get co-located `*.spec.ts`
  (Vitest) — pure logic, unit-testable against synthetic data.
- `infrastructure/browser/`, `presentation/`, and manifest/service-worker
  behavior are verified manually (mic permission flow, Canvas rendering,
  offline/install behavior) — not unit tested.

## Delivery convention

The MVP (see the plan file) shipped in 9 pre-approved chunks; a post-MVP
plan (also in the same plan file, "Post-MVP chunk plan" section) added
scale auto-detection, crosstalk warnings, and the spectrum view across
parallel capability chunks (A/B/D/E/G) plus one final integration chunk
(Chunk I, wiring all three into `src/app/**`/`src/main.ts`) — that
integration is complete as of this writing. Each chunk is independently
buildable/testable; don't skip ahead into a later chunk's scope even if it
looks convenient — the split exists to keep every commit in a verifiably
working state.
