id: ts-float32array-arraybuffer-generic-dom-apis
type: anti-pattern
topic: general
perspective: the-coder
created: 1787920842.426182
---

Tried: `private buffer: Float32Array | null = null` later filled via `new Float32Array(size)` and passed to a DOM API typed to want `Float32Array<ArrayBuffer>` (e.g. AnalyserNode.getFloatTimeDomainData).
Failed because: modern TS DOM lib types Float32Array as generic over its buffer type; an untyped field declaration infers/widens to `Float32Array<ArrayBufferLike>`, which isn't assignable to APIs expecting the more specific `Float32Array<ArrayBuffer>`.
Instead: pin the generic explicitly on the field declaration, e.g. `Float32Array<ArrayBuffer> | null`, when the value will flow into a DOM API with that stricter signature.