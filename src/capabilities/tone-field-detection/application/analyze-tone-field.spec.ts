import { describe, expect, it } from 'vitest'
import { createFrequency } from '../domain/value-objects'
import type { AudioFrameSource, PitchDetector } from './ports'
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
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), pitchDetector, 3)

    useCase.analyze()
    useCase.analyze()
    const reading = useCase.analyze()

    expect(reading?.fundamental.frequency).toBe(440)
  })

  it('does not dilute the smoothing window on a temporary dropout', () => {
    const pitchDetector = new FakePitchDetector([440, 440, null, 440])
    const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), pitchDetector, 3)

    useCase.analyze()
    useCase.analyze()
    const droppedOut = useCase.analyze()
    const reading = useCase.analyze()

    expect(droppedOut).toBeNull()
    expect(reading?.fundamental.frequency).toBe(440)
  })
})
