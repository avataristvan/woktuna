declare const frequencyBrand: unique symbol
declare const centDeviationBrand: unique symbol

/** A frequency in Hz. Always > 0 — construct via `createFrequency`. */
export type Frequency = number & { readonly [frequencyBrand]: true }

/** A pitch deviation expressed in cents (1/100 semitone). Can be negative. */
export type CentDeviation = number & { readonly [centDeviationBrand]: true }

export function createFrequency(hz: number): Frequency {
  if (!(hz > 0)) {
    throw new RangeError(`Frequency must be > 0 Hz, got ${hz}`)
  }
  return hz as Frequency
}

export function createCentDeviation(cents: number): CentDeviation {
  return cents as CentDeviation
}

/**
 * Local to this capability for now — don't import shared-kernel yet since it's
 * still empty (Chunk 1 scaffold only). Chunk 6/7 reconciles this with
 * shared-kernel/partial-kind.ts once octave/compoundFifth detection lands.
 */
export type PartialKind = 'fundamental' | 'octave' | 'compoundFifth'

export interface PartialReading {
  readonly kind: PartialKind
  readonly frequency: Frequency
}

/**
 * octave and compoundFifth stay undefined until Chunk 6 adds FFT
 * peak-picking relative to the detected fundamental.
 */
export interface ToneFieldReading {
  readonly fundamental: PartialReading
  readonly octave?: PartialReading
  readonly compoundFifth?: PartialReading
}
