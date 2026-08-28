import type { Scale } from '../capabilities/scale-configuration/domain/scale'
import type { HammerMode } from '../capabilities/tone-field-visualization/domain/hammer-direction'

export type { HammerMode }

/**
 * Minimal cross-cutting UI state that doesn't belong to any single
 * capability. `hammerMode` drives Chunk 8's inside/outside hammering toggle,
 * read by `bootstrap.ts`'s render loop every tick and passed into
 * `buildGuidance`.
 */
export class AppState {
  activeScale: Scale
  hammerMode: HammerMode = 'outside'

  constructor(initialScale: Scale) {
    this.activeScale = initialScale
  }

  setHammerMode(mode: HammerMode): void {
    this.hammerMode = mode
  }
}
