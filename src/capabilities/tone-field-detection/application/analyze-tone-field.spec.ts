import { describe, expect, it } from 'vitest'
import { createFrequency } from '../domain/value-objects'
import type { AudioFrameSource, PartialDetectionResult, PartialDetector, PitchDetector } from './ports'
import { AnalyzeToneField } from './analyze-tone-field'

class FakeAudioFrameSource implements AudioFrameSource {
  readonly sampleRate = 44100

  getFrame(): Float32Array {
    return new Float32Array(0)
  }
}

class FakePitchDetector implements PitchDetector {
  private readonly readingsHz: readonly (number | null)[]
  private index = 0

  constructor(readingsHz: readonly (number | null)[]) {
    this.readingsHz = readingsHz
  }

  detectFundamental() {
    const hz = this.readingsHz[this.index]
    this.index = Math.min(this.index + 1, this.readingsHz.length - 1)
    return hz === null ? null : createFrequency(hz)
  }
}

class FakePartialDetector implements PartialDetector {
  private readonly result: PartialDetectionResult

  constructor(result: PartialDetectionResult) {
    this.result = result
  }

  detectPartials(): PartialDetectionResult {
    return this.result
  }
}

describe('AnalyzeToneField', () => {
  it('reports the fundamental on the happy path', () => {
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), new FakePitchDetector([440]))

    const reading = useCase.analyze()

    expect(reading?.fundamental.kind).toBe('fundamental')
    expect(reading?.fundamental.frequency).toBe(440)
  })

  it('leaves octave and compoundFifth unpopulated', () => {
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), new FakePitchDetector([440]))

    const reading = useCase.analyze()

    expect(reading?.octave).toBeUndefined()
    expect(reading?.compoundFifth).toBeUndefined()
  })

  it('returns null when no fundamental is detected', () => {
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), new FakePitchDetector([null]))

    expect(useCase.analyze()).toBeNull()
  })

  it('smooths consecutive readings via a moving median', () => {
    const pitchDetector = new FakePitchDetector([440, 440, 460])
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), pitchDetector, { smoothingWindow: 3 })

    useCase.analyze()
    useCase.analyze()
    const reading = useCase.analyze()

    expect(reading?.fundamental.frequency).toBe(440)
  })

  it('does not dilute the smoothing window on a temporary dropout', () => {
    const pitchDetector = new FakePitchDetector([440, 440, null, 440])
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), pitchDetector, { smoothingWindow: 3 })

    useCase.analyze()
    useCase.analyze()
    const droppedOut = useCase.analyze()
    const reading = useCase.analyze()

    expect(droppedOut).toBeNull()
    expect(reading?.fundamental.frequency).toBe(440)
  })

  it('tracks a jump to a newly-struck tone field immediately, not after several frames', () => {
    // Median smoothing would otherwise treat the first 294Hz reading as an
    // "outlier" against the still-440Hz-heavy window and keep reporting the
    // previous field's pitch for a couple of frames.
    const pitchDetector = new FakePitchDetector([440, 440, 440, 294])
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), pitchDetector, { smoothingWindow: 5 })

    useCase.analyze()
    useCase.analyze()
    useCase.analyze()
    const reading = useCase.analyze()

    expect(reading?.fundamental.frequency).toBe(294)
  })

  it('populates octave/compoundFifth when a PartialDetector is provided and finds them', () => {
    const octaveHz = createFrequency(880)
    const compoundFifthHz = createFrequency(1320)
    const partialDetector = new FakePartialDetector({ octave: octaveHz, compoundFifth: compoundFifthHz })
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), new FakePitchDetector([440]), { partialDetector })

    const reading = useCase.analyze()

    expect(reading?.octave).toEqual({ kind: 'octave', frequency: octaveHz })
    expect(reading?.compoundFifth).toEqual({ kind: 'compoundFifth', frequency: compoundFifthHz })
  })

  it('leaves octave/compoundFifth undefined when no PartialDetector is provided (backward compatible)', () => {
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), new FakePitchDetector([440]))

    const reading = useCase.analyze()

    expect(reading?.octave).toBeUndefined()
    expect(reading?.compoundFifth).toBeUndefined()
  })

  it('leaves a partial undefined when the PartialDetector does not find it', () => {
    const partialDetector = new FakePartialDetector({ octave: createFrequency(880), compoundFifth: null })
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), new FakePitchDetector([440]), { partialDetector })

    const reading = useCase.analyze()

    expect(reading?.octave).toEqual({ kind: 'octave', frequency: createFrequency(880) })
    expect(reading?.compoundFifth).toBeUndefined()
  })
})
