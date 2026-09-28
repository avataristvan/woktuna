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

class SequencePartialDetector implements PartialDetector {
  private readonly results: readonly PartialDetectionResult[]
  private index = 0

  constructor(results: readonly PartialDetectionResult[]) {
    this.results = results
  }

  detectPartials(): PartialDetectionResult {
    const result = this.results[this.index]
    this.index = Math.min(this.index + 1, this.results.length - 1)
    return result
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
  describe('partial smoothing and hold', () => {
    const found = (octaveHz: number | null): PartialDetectionResult => ({
      octave: octaveHz === null ? null : createFrequency(octaveHz),
      compoundFifth: null,
    })

    function setup(fundamentals: (number | null)[], partials: PartialDetectionResult[], partialHoldMs?: number) {
      let nowMs = 0
      const useCase = new AnalyzeToneField(new FakeAudioFrameSource(), new FakePitchDetector(fundamentals), {
        partialDetector: new SequencePartialDetector(partials),
        partialHoldMs,
        now: () => nowMs,
      })
      return {
        useCase,
        advance: (ms: number) => {
          nowMs += ms
        },
      }
    }

    it('suppresses a one-frame outlier via the median', () => {
      const { useCase } = setup([440, 440, 440], [found(880), found(880), found(890)])

      useCase.analyze()
      useCase.analyze()

      expect(useCase.analyze()?.octave?.frequency).toBe(880)
    })

    it('holds the last median while within partialHoldMs', () => {
      const { useCase, advance } = setup([440, 440], [found(880), found(null)])

      useCase.analyze()
      advance(400)

      expect(useCase.analyze()?.octave?.frequency).toBe(880)
    })

    it('returns undefined once the hold has expired', () => {
      const { useCase, advance } = setup([440, 440], [found(880), found(null)])

      useCase.analyze()
      advance(401)

      expect(useCase.analyze()?.octave).toBeUndefined()
    })

    it('does not resurrect an expired hold on a later null frame', () => {
      const { useCase, advance } = setup([440, 440, 440], [found(880), found(null), found(null)])

      useCase.analyze()
      advance(500)
      useCase.analyze()
      advance(10)

      expect(useCase.analyze()?.octave).toBeUndefined()
    })

    it('clears a held partial when the fundamental jumps to a new strike', () => {
      const { useCase, advance } = setup([440, 294], [found(880), found(null)])

      useCase.analyze()
      advance(50)
      const reading = useCase.analyze()

      expect(reading?.fundamental.frequency).toBe(294)
      expect(reading?.octave).toBeUndefined()
    })

    it('restarts a partial window when its own value jumps', () => {
      const { useCase } = setup([440, 440, 440], [found(880), found(880), found(1320)])

      useCase.analyze()
      useCase.analyze()

      expect(useCase.analyze()?.octave?.frequency).toBe(1320)
    })

    it('honours a custom partialHoldMs', () => {
      const { useCase, advance } = setup([440, 440], [found(880), found(null)], 100)

      useCase.analyze()
      advance(101)

      expect(useCase.analyze()?.octave).toBeUndefined()
    })
  })
})
