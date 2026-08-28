import type { PartialReading, ToneFieldReading } from '../domain/value-objects'
import { createFrequency } from '../domain/value-objects'
import type { AudioFrameSource, PitchDetector } from './ports'

const DEFAULT_SMOOTHING_WINDOW = 5

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
