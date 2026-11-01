id: learning_tsconfig_erasable_syntax_only
type: pattern
topic: general
created: 1787920866.268068
---

This project's tsconfig.json has `erasableSyntaxOnly: true`, which rejects TypeScript constructor-parameter-property shorthand (e.g. `constructor(private readonly x: T)`). Future chunks must use explicit field declarations + body assignment instead (`private readonly x: T; constructor(x: T) { this.x = x }`).