id: dsp-decouple-analysis-window-from-buffer-size
type: pattern
topic: general
perspective: the-coder
created: 1787921660.491321
---

Pattern: When capping a correlation/analysis window size for performance (autocorrelation pitch detection, or similar O(n*m) DSP over a lag/shift range), decouple the window length from any buffer sized for a *different* purpose (e.g. an FFT buffer sized for bin resolution). Accuracy in lag-based/interpolation-based estimators comes from the interpolation step, not from raw window length past a few periods of the lowest frequency of interest -- an 8x shorter window can cost <1 cent of extra error while cutting compute ~8-9x (cache locality on the smaller array compounds the linear compute reduction). Measure the actual per-call cost against the real budget (e.g. 16.7ms rAF) before trusting an assumed-fine window size carried over from a different sizing rationale.
When: Any real-time pitch/period detector (autocorrelation, YIN, etc.) whose analysis buffer was sized for an unrelated downstream need (FFT resolution, other consumers of the same raw buffer).