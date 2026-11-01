id: shared-fft-analyzer-two-consumers-deletion-trap
type: anti-pattern
topic: general
perspective: the-coder
created: 1787930345.813328
---

Tried: deleting a feature (crosstalk-detection) that happened to share an FFT/spectrum-analyzer instance with a feature being kept (spectrum-view panel) in a composition root. First edit pass deleted the shared analyzer import along with the deleted feature's other imports, then patched the surviving spectrum-panel code path to call a wrong/nonexistent method on an unrelated detector object just to make something compile.
Failed because: two unrelated call sites (a throttled diagnostic check, and a UI panel) both depended on the same shared infrastructure object (FftSpectrumAnalyzer) -- deleting the object because 'it belonged to the feature I'm removing' broke the other, kept, call site. The mistake was caught by TypeScript only because the wrong-method substitution happened to not exist on the class; a same-named-method substitution would have silently compiled and been wrong at runtime.
Instead: before deleting an object/service from a composition root during a feature removal, grep every call site of that object within the file (not just the ones near the code being deleted) and re-verify which capability's deletion is actually the sole/last consumer before dropping the shared dependency.