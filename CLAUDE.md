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

## PWA policy

The service worker must only register in production. `vite-plugin-pwa`'s
`devOptions.enabled` stays at its default `false` — a stale dev-mode SW
causes confusing "my change isn't showing up" symptoms (seen in an earlier
project). Don't flip this on
without adding an explicit dev-mode `unregister()` fallback.

## Testing conventions

- `domain/` and `infrastructure/dsp/` files get co-located `*.spec.ts`
  (Vitest) — pure logic, unit-testable against synthetic data.
- `infrastructure/browser/`, `presentation/`, and manifest/service-worker
  behavior are verified manually (mic permission flow, Canvas rendering,
  offline/install behavior) — not unit tested.

## Delivery convention

Build proceeds in 9 pre-approved chunks (see the plan file), each
independently buildable/testable. Don't skip ahead into a later chunk's
scope even if it looks convenient — the split exists to keep every commit
in a verifiably working state.
