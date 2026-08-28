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
- FFT tolerance window for octave/fifth search (±200–300 cents proposed,
  Chunk 6) — likely needs tuning after real-hardware testing.
- No existing source confirms the exact crosstalk-axis relationship or
  strike-path diagram (research doc §5) — the whole detection pipeline needs
  real-hardware validation before being trusted for actual tuning.

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
