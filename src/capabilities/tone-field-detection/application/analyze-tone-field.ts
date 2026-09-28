import type { Frequency, PartialReading, ToneFieldReading } from '../domain/value-objects'
import { createFrequency } from '../domain/value-objects'
import type { AudioFrameSource, PartialDetector, PitchDetector } from './ports'

const DEFAULT_SMOOTHING_WINDOW = 5
const DEFAULT_PARTIAL_SMOOTHING_WINDOW = 5

/**
 * How long the last octave/compoundFifth median is held after the detector
 * stops finding that partial. Deliberately longer than the UI's 300 ms
 * "stale" threshold (a later chunk): the UI marks a held value as stale
 * first, and only then does the reading vanish entirely.
 */
const DEFAULT_PARTIAL_HOLD_MS = 400

/**
 * A raw reading further than this from the current running median is
 * treated as a new strike (a new tone field), not an outlier of the current
 * one — see the staleness-reset note on `analyze()`.
 */
const JUMP_RESET_THRESHOLD_CENTS = 100

export interface AnalyzeToneFieldOptions {
  smoothingWindow?: number
  /**
   * When omitted, octave/compoundFifth stay unpopulated on every returned
   * reading — this keeps existing callers/tests working unchanged. Passed
   * in from Chunk 6 onward via bootstrap.ts's FftPartialDetector.
   */
  partialDetector?: PartialDetector
  partialSmoothingWindow?: number
  partialHoldMs?: number
  now?: () => number
}

interface PartialState {
  recentHz: number[]
  lastValidAtMs: number | null
}

function createPartialState(): PartialState {
  return { recentHz: [], lastValidAtMs: null }
}

export class AnalyzeToneField {
  private readonly audioFrameSource: AudioFrameSource
  private readonly pitchDetector: PitchDetector
  private readonly partialDetector: PartialDetector | undefined
  private readonly smoothingWindow: number
  private readonly recentFundamentalsHz: number[] = []
  private readonly partialSmoothingWindow: number
  private readonly partialHoldMs: number
  private readonly now: () => number
  private readonly octaveState = createPartialState()
  private readonly compoundFifthState = createPartialState()

  constructor(audioFrameSource: AudioFrameSource, pitchDetector: PitchDetector, options: AnalyzeToneFieldOptions = {}) {
    this.audioFrameSource = audioFrameSource
    this.pitchDetector = pitchDetector
    this.partialDetector = options.partialDetector
    this.smoothingWindow = options.smoothingWindow ?? DEFAULT_SMOOTHING_WINDOW
    this.partialSmoothingWindow = options.partialSmoothingWindow ?? DEFAULT_PARTIAL_SMOOTHING_WINDOW
    this.partialHoldMs = options.partialHoldMs ?? DEFAULT_PARTIAL_HOLD_MS
    this.now = options.now ?? (() => performance.now())
  }

  /**
   * Pulls one frame, detects the fundamental, and folds it into a moving
   * median over the last `smoothingWindow` readings. Returns null while no
   * stable fundamental has been detected yet (e.g. silence) — the smoothing
   * window itself is left untouched so a later good reading isn't diluted by
   * a temporary dropout.
   *
   * If the raw reading jumps more than JUMP_RESET_THRESHOLD_CENTS away from
   * the current running median, the smoothing window is cleared and restarts
   * from just this reading instead of blending it in — otherwise a median
   * filter treats a freshly-struck (different) tone field's note as the
   * "outlier" and keeps reporting the previous field's pitch for the next
   * few frames.
   *
   * octave/compoundFifth stay unpopulated on the returned ToneFieldReading
   * unless a PartialDetector was supplied in the constructor options — when
   * one is, they're populated by searching the *same* frame (not a fresh
   * one) relative to the just-smoothed fundamental, so all three partials
   * describe one single strike.
   *
   * Each partial is smoothed with its own moving median and held for
   * `partialHoldMs` after the detector stops finding it; past that it is
   * undefined (no reading, never a fabricated value). Partial state is reset
   * when the fundamental jump-reset fires (new strike) and when a partial's
   * own raw value jumps away from its median. Null-fundamental (silence)
   * frames do not touch partial state: the hold timing already bounds
   * staleness, and analyze() returns null for those frames anyway.
   */
  analyze(): ToneFieldReading | null {
    const frame = this.audioFrameSource.getFrame()
    const detectedHz = this.pitchDetector.detectFundamental(frame, this.audioFrameSource.sampleRate)

    if (detectedHz === null) {
      return null
    }

    if (this.recentFundamentalsHz.length > 0 && isJump(detectedHz, median(this.recentFundamentalsHz))) {
      this.recentFundamentalsHz.length = 0
      resetPartialState(this.octaveState)
      resetPartialState(this.compoundFifthState)
    }

    this.recentFundamentalsHz.push(detectedHz)
    if (this.recentFundamentalsHz.length > this.smoothingWindow) {
      this.recentFundamentalsHz.shift()
    }

    const fundamental: PartialReading = {
      kind: 'fundamental',
      frequency: createFrequency(median(this.recentFundamentalsHz)),
    }

    if (!this.partialDetector) {
      return { fundamental }
    }

    const partials = this.partialDetector.detectPartials(frame, this.audioFrameSource.sampleRate, fundamental.frequency)

    const octave = this.smoothPartial(this.octaveState, partials.octave)
    const compoundFifth = this.smoothPartial(this.compoundFifthState, partials.compoundFifth)

    return {
      fundamental,
      octave: octave === undefined ? undefined : { kind: 'octave', frequency: octave },
      compoundFifth: compoundFifth === undefined ? undefined : { kind: 'compoundFifth', frequency: compoundFifth },
    }
  }

  private smoothPartial(state: PartialState, rawHz: Frequency | null): Frequency | undefined {
    const nowMs = this.now()

    if (rawHz === null) {
      if (state.lastValidAtMs !== null && nowMs - state.lastValidAtMs <= this.partialHoldMs) {
        return createFrequency(median(state.recentHz))
      }
      resetPartialState(state)
      return undefined
    }

    if (state.recentHz.length > 0 && isJump(rawHz, median(state.recentHz))) {
      state.recentHz.length = 0
    }
    state.recentHz.push(rawHz)
    if (state.recentHz.length > this.partialSmoothingWindow) {
      state.recentHz.shift()
    }
    state.lastValidAtMs = nowMs
    return createFrequency(median(state.recentHz))
  }
}

function isJump(rawHz: number, medianHz: number): boolean {
  return Math.abs(1200 * Math.log2(rawHz / medianHz)) > JUMP_RESET_THRESHOLD_CENTS
}

function resetPartialState(state: PartialState): void {
  state.recentHz.length = 0
  state.lastValidAtMs = null
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
