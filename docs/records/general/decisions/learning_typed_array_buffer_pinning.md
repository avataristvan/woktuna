id: learning_typed_array_buffer_pinning
type: pattern
topic: general
created: 1787920866.268068
---

When a class field holds a Float32Array that gets passed into Web Audio APIs like `AnalyserNode.getFloatTimeDomainData`, the field type must be explicitly pinned as `Float32Array<ArrayBuffer>` — the inferred `Float32Array<ArrayBufferLike>` from a plain `new Float32Array(n)` doesn't satisfy the DOM lib's expected type in this TS/lib version.