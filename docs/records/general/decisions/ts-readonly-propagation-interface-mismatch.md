id: ts-readonly-propagation-interface-mismatch
type: anti-pattern
topic: general
perspective: the-coder
created: 1787921660.491321
---

Anti-pattern: marking a const `as const` / a field `readonly` on a data array is not always a pure add-on -- if that array's element type has a field the *interface* itself types as mutable (e.g. `notes: NoteName[]`), the readonly array literal becomes structurally incompatible with the mutable-typed field (a `readonly T[]` is not assignable to `T[]`). The fix is to widen the interface's field to `readonly T[]` too, not just the const declaration -- check every place the type is used for in-place mutation (rare in domain layers) before propagating readonly through an interface.
When: Applying an "add readonly/as const to prevent accidental mutation" fix to an exported constant, in TypeScript.