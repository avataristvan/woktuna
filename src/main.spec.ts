import { describe, expect, it, beforeEach, vi } from 'vitest'

describe('scaffold', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = '<div id="app"></div>'
  })

  it('renders the WokTuna shell into #app', async () => {
    await import('./main')

    expect(document.querySelector('#app')?.textContent).toContain('WokTuna')
  })

  it('renders the tuner UI skeleton', async () => {
    await import('./main')

    expect(document.querySelector('#start-button')).not.toBeNull()
    expect(document.querySelector('#note-name')).not.toBeNull()
    expect(document.querySelectorAll('#tuner-panel.tuner-panel .tuner-row').length).toBe(3)
    const settings = document.querySelector<HTMLDetailsElement>('details.settings')
    expect(settings).not.toBeNull()
    expect(settings!.open).toBe(false)
    expect(document.querySelector('#reference-pitch-input')).not.toBeNull()
    expect(document.querySelector('#tolerance-cents-input')).not.toBeNull()
    expect(
      document.querySelectorAll('input[name="hammer-mode"]').length,
    ).toBe(2)
  })
})
