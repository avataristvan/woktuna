import type { NoteName } from './note'

/**
 * An ordered list of scale degrees a handpan is tuned to.
 */
export interface Scale {
  name: string
  notes: NoteName[]
}
