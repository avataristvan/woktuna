import type { AudioFrameSource } from '../../application/ports'

/**
 * ~341ms window at 48kHz. Halved from 32768 during the Chunk 6.5 review
 * pass — autocorrelation.ts (~4.8ms) + fft-peak-picking.ts (~3ms at 32768)
 * were together consuming roughly half the 16.7ms rAF frame budget on a
 * desktop dev machine, with real mobile hardware unmeasured and plausibly
 * 3-5x worse. Halving this constant roughly halves the FFT cost (measured
 * ~2.9ms -> ~1.3ms) while leaving adequate cent resolution; verified safe
 * against fft-peak-picking.ts's low-fundamental edge case (a ~110Hz
 * fundamental — bottom of the handpan range — combined with this smaller
 * window makes the tight fundamental-reference search band collapse to as
 * few as 2 FFT bins, which the noise-floor check added in that same review
 * pass had to be widened to tolerate) with a dedicated test in
 * fft-peak-picking.spec.ts. 4096 was NOT verified safe and should not be
 * assumed to be — re-check the low-fundamental edge case again before
 * going any lower than this.
 * Must be a power of 2 in [32, 32768] per the Web Audio spec.
 */
const DEFAULT_FFT_SIZE = 16384

/**
 * Implements AudioFrameSource via getUserMedia + AudioContext + AnalyserNode.
 * Not unit tested (see plan) — mic access can't be exercised in this
 * environment; verify manually against a real microphone in-browser.
 */
export class WebAudioMicrophoneSource implements AudioFrameSource {
  private readonly fftSize: number
  private audioContext: AudioContext | null = null
  private analyserNode: AnalyserNode | null = null
  private timeDomainBuffer: Float32Array<ArrayBuffer> | null = null

  constructor(fftSize: number = DEFAULT_FFT_SIZE) {
    this.fftSize = fftSize
  }

  /** Must be called (and awaited) once, after a user gesture, before getFrame()/sampleRate are used. */
  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    this.audioContext = new AudioContext()
    const sourceNode = this.audioContext.createMediaStreamSource(stream)

    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = this.fftSize
    sourceNode.connect(this.analyserNode)

    this.timeDomainBuffer = new Float32Array(this.analyserNode.fftSize)
  }

  get sampleRate(): number {
    if (this.audioContext === null) {
      throw new Error('WebAudioMicrophoneSource.start() must be called before reading sampleRate')
    }
    return this.audioContext.sampleRate
  }

  getFrame(): Float32Array {
    if (this.analyserNode === null || this.timeDomainBuffer === null) {
      throw new Error('WebAudioMicrophoneSource.start() must be called before reading frames')
    }
    this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer)
    return this.timeDomainBuffer
  }
}
