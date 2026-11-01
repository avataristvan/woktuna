id: test-synthetic-spectrum-bin-resolution-must-fit-tolerance-band
type: anti-pattern
topic: general
perspective: the-coder
created: 1787923979.471485
---

Tried: unit-testing a band-limited spectral peak search (find the strongest bin within +-N cents of a target Hz) against a hand-built synthetic SpectrumReading (fake magnitudes array + linear binToHz/hzToBin), using a coarse bin resolution (10 Hz/bin) for convenience.
Failed because: at a few-hundred-Hz target with a tight tolerance (50 cents), the +-N-cent band collapsed to 0-1 bins, so the implementation's own 'binHigh <= binLow -> return null' guard rejected every candidate outright -- every test returned [] regardless of injected peak magnitude, looking like a logic bug when the search-band math was actually correct.
Instead: pick synthetic bin resolution fine enough that the tolerance band around the smallest target Hz spans several bins (e.g. 1 Hz/bin for ~200-500 Hz targets with a 50-cent tolerance), and size the spectrum array to cover all target frequencies plus margin. When a band-limited peak search over a fake Hz<->bin mapping returns empty for every case including ones with an injected peak, check the band-width-in-bins first before suspecting the peak/floor logic.