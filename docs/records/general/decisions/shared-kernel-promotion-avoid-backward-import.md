id: shared-kernel-promotion-avoid-backward-import
type: pattern
topic: general
perspective: the-coder
created: 1787922502.279631
---

When promoting a pure constant/helper from a capability's domain layer into a shared-kernel (capability-centric DDD, dependencies point inward: domain ← application ← infrastructure ← ui, with shared-kernel sitting below capabilities), do NOT have shared-kernel import from the capability it's being promoted out of — that inverts the dependency direction shared-kernel exists to establish (capabilities depend on shared-kernel, never the reverse). Instead duplicate the small constant/logic into shared-kernel with a comment explaining the duplication is deliberate (cites which capability's module holds the 'other' copy and why), and leave the original capability file untouched unless the task explicitly asks you to refactor it to consume shared-kernel too. This keeps the promotion a pure additive change — zero risk to the capability's already-passing tests — while still giving new/other capabilities a single canonical source going forward.