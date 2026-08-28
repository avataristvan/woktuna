import type { AudioFrameSource } from '../../application/ports'

/**
 * ~682ms window at 48kHz — the plan's MVP tradeoff (AnalyserNode + rAF
 * polling, not AudioWorklet) needs an analysis window this large for
 * adequate cent resolution at handpan fundamental ranges; that main-thread
 * cost is judged acceptable unless real-device profiling shows jank.
 * Must be a power of 2 in [32, 32768] per the Web Audio spec.
 */
const DEFAULT_FFT_SIZE = 32768

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
