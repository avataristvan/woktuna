/**
 * Domain types for hammer guidance rendered onto a tone field.
 *
 * No color/DOM concept lives here — `Severity` is an ordinal the
 * presentation layer maps to a color (see `presentation/color-scale.ts`).
 */

/** Ordinal deviation-severity bucket, independent of direction (flat/sharp) or axis. */
export type Severity = 'inTune' | 'slight' | 'moderate' | 'significant'

/**
 * Deviation signal for one octave/compound-fifth axis marker.
 * `axis` says which axis of the oval this reading belongs to — per research
 * doc §2.1, octave sits on the long axis, compound fifth on the short axis.
 */
export interface AxisGuidance {
  axis: 'long' | 'short'
  centDeviation: number
  severity: Severity
}

/**
 * Full hammer-guidance signal for one struck tone field.
 *
 * `longAxis`/`shortAxis` are nullable because octave/compound-fifth partial
 * detection isn't wired up yet (lands in a later chunk) — a `null` axis
 * means "no reading available", not "in tune".
 */
export interface ToneFieldGuidance {
  radial: {
    centDeviation: number
    severity: Severity
  }
  longAxis: AxisGuidance | null
  shortAxis: AxisGuidance | null
  hammerBias: 'center' | 'edge' | 'inTune'
}
