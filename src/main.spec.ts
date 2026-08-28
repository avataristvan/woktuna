import { describe, expect, it, beforeEach } from 'vitest'

describe('scaffold', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
  })

  it('renders the WokTuna shell into #app', async () => {
    await import('./main')

    expect(document.querySelector('#app')?.textContent).toContain('WokTuna')
  })
})
