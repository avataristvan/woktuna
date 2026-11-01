id: ts-erasable-syntax-only-blocks-parameter-properties
type: anti-pattern
topic: general
perspective: the-coder
created: 1787920837.732474
---

Tried: constructor parameter-property shorthand (`constructor(private readonly x: T)`) in a TypeScript class under a tsconfig with `erasableSyntaxOnly: true` (common in modern Vite scaffolds).
Failed because: erasableSyntaxOnly rejects it with TS1294 'This syntax is not allowed when erasableSyntaxOnly is enabled' — the shorthand isn't erasable-only syntax.
Instead: declare the field explicitly as a class field (`private readonly x: T`) and assign it in the constructor body (`this.x = x`). Check tsconfig.json's compilerOptions for this flag before writing any class with constructor-injected readonly fields.