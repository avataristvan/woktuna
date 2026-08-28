import type { Scale } from '../capabilities/scale-configuration/domain/scale'

export type HammerMode = 'outside' | 'inside'

/**
 * Minimal cross-cutting UI state that doesn't belong to any single
 * capability. `hammerMode` is a placeholder for Chunk 8's inside/outside
 * hammering toggle — not wired to any UI or guidance logic yet, typed now so
 * that chunk doesn't need to restructure this file.
 */
export class AppState {
  activeScale: Scale
  hammerMode: HammerMode = 'outside'

  constructor(initialScale: Scale) {
    this.activeScale = initialScale
  }
}
