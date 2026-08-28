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

## DSP gotchas (Chunk 6: octave/compound-fifth FFT peak-picking)

- `fft-peak-picking.ts` computes its own FFT over the full frame (up to
  `DEFAULT_FFT_SIZE`=32768, truncated down to the largest power of 2 that
  fits) — this is deliberately a *different* window than
  `autocorrelation.ts`'s 4096-sample `CORRELATION_WINDOW_SAMPLES`. The large
  window is exactly why that buffer is sized the way it is (see the Chunk
  5.5 gotcha below); FFT bin resolution needs it, autocorrelation doesn't.
  Don't let a future refactor try to make these two DSP files share one
  window length.
- The octave/compound-fifth search-band tolerance (`DEFAULT_TOLERANCE_CENTS`
  in `fft-peak-picking.ts`, currently ±250 cents) is an explicit TODO/tunable,
  not a settled value — too narrow misses badly-detuned partials (the whole
  point of a *pre*-tuning app), too wide risks locking onto crosstalk from a
  neighboring tone field (research doc §2.5's open, unresolved question).
  Needs real-hardware validation before treating as final.
- A candidate peak only counts as "found" if it's a local maximum within its
  search band AND at least `MIN_PARTIAL_TO_FUNDAMENTAL_RATIO` (5%) of the
  fundamental's own peak magnitude — this is what lets a missing partial
  return `null` instead of a false positive from window-leakage noise.
  Global-magnitude/median-based noise floors don't work here (the floor is
  near-zero across most of a mostly-silent synthetic spectrum, so leakage
  tails from a real neighboring peak can still clear it) — the fundamental's
  own magnitude is the only reliable per-frame reference.
- `AnalyzeToneField`'s constructor takes an `AnalyzeToneFieldOptions` object
  now (`{ smoothingWindow?, partialDetector? }`), not a positional
  `smoothingWindow` third argument — this changed in Chunk 6 when a fourth
  dependency (`PartialDetector`) was added.

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
