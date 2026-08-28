import type { NoteName } from './note'

/**
 * An ordered list of scale degrees a handpan is tuned to.
 */
export interface Scale {
  readonly name: string
  readonly notes: readonly NoteName[]
}
