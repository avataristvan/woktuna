id: ts-erasable-syntax-only-no-parameter-properties
type: anti-pattern
topic: general
perspective: the-coder
created: 1787920842.426182
---

Tried: writing TypeScript constructor parameter properties (`constructor(private readonly x: T) {}`) in a project with tsconfig `erasableSyntaxOnly: true`.
Failed because: erasableSyntaxOnly forbids any TS syntax that isn't erasable by simply stripping types (parameter-property shorthand actually emits a field assignment, so it's not erasable) — tsc errors with TS1294.
Instead: declare fields explicitly (`private readonly x: T`) and assign them in the constructor body (`this.x = x`). Check tsconfig for `erasableSyntaxOnly` before defaulting to parameter-property shorthand, especially in newer Vite/TS scaffolds that enable it by default.