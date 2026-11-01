id: defer-browser-api-construction-for-jsdom-testable-composition-root
type: pattern
topic: general
perspective: the-coder
created: 1787921290.61161
---

Pattern: in a composition root (bootstrap.ts style) that wires domain/application use-cases to a browser-only presentation object requiring an unavailable-in-jsdom API (e.g. HTMLCanvasElement.getContext('2d'), which jsdom returns null for without a native canvas polyfill), construct that object lazily inside the user-gesture-gated start() method rather than eagerly at composition-root call time. This lets an existing smoke test that imports main.ts/calls the composition root at module-evaluation time (common in Vite scaffolds) keep passing under jsdom with zero mocking, since the browser-API-dependent constructor never runs until a real user clicks Start. Also naturally matches the actual runtime requirement (mic access itself is already gated behind a user gesture) without adding any test-only branching or environment checks in production code.