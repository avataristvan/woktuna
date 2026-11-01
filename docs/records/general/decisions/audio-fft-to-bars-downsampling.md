id: audio-fft-to-bars-downsampling
type: pattern
topic: general
perspective: the-coder
created: 1787923917.51881
---

Feedback: downsampling a raw FFT magnitude spectrum into a small bar-chart/equalizer view (e.g. ~64-128 bars from thousands of bins) reads best with three choices: (1) log-spaced frequency bands, not linear-Hz bands, because musical/audio content has multiplicative relationships (octaves, harmonics) that equal-ratio bands represent naturally; (2) per-band magnitude = max of the raw bins in that band, not average -- averaging flattens narrow spectral peaks, especially in low bands where a band can span only a handful of raw bins; (3) normalize each bar to the frame's OWN peak bar (not a fixed reference level) so the tallest bar always hits 1.0 regardless of input level, with an explicit peak===0 guard to avoid NaN on a silent frame. Verify with synthetic single/multi-peak spectra (not real audio) in the unit test -- e.g. assert the peak bin's frequency lands in the expected bar, and that a quieter second peak is still visible (not zeroed out by the loudest one).