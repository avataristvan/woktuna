import type { PartialReading, ToneFieldReading } from '../domain/value-objects'
import { createFrequency } from '../domain/value-objects'
import type { AudioFrameSource, PitchDetector } from './ports'

const DEFAULT_SMOOTHING_WINDOW = 5

/**
 * A raw reading further than this from the current running median is
 * treated as a new strike (a new tone field), not an outlier of the current
 * one — see the staleness-reset note on `analyze()`.
 */
const JUMP_RESET_THRESHOLD_CENTS = 100

export class AnalyzeToneField {
  private readonly audioFrameSource: AudioFrameSource
  private readonly pitchDetector: PitchDetector
  private readonly smoothingWindow: number
  private readonly recentFundamentalsHz: number[] = []

  constructor(
    audioFrameSource: AudioFrameSource,
    pitchDetector: PitchDetector,
    smoothingWindow: number = DEFAULT_SMOOTHING_WINDOW,
  ) {
    this.audioFrameSource = audioFrameSource
    this.pitchDetector = pitchDetector
    this.smoothingWindow = smoothingWindow
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
   * until Chunk 6 adds a PartialDetector (FFT peak-picking relative to this
   * fundamental) — intentionally omitted here rather than stubbed, so
   * Chunk 6 can add them without restructuring this method.
   */
  analyze(): ToneFieldReading | null {
    const frame = this.audioFrameSource.getFrame()
    const detectedHz = this.pitchDetector.detectFundamental(frame, this.audioFrameSource.sampleRate)

    if (detectedHz === null) {
      return null
    }

    if (this.recentFundamentalsHz.length > 0) {
      const currentMedianHz = median(this.recentFundamentalsHz)
      const jumpCents = Math.abs(1200 * Math.log2(detectedHz / currentMedianHz))
      if (jumpCents > JUMP_RESET_THRESHOLD_CENTS) {
        this.recentFundamentalsHz.length = 0
      }
    }

    this.recentFundamentalsHz.push(detectedHz)
    if (this.recentFundamentalsHz.length > this.smoothingWindow) {
      this.recentFundamentalsHz.shift()
    }

    const fundamental: PartialReading = {
      kind: 'fundamental',
      frequency: createFrequency(median(this.recentFundamentalsHz)),
    }

    return { fundamental }
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
