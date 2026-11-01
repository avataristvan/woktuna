id: ddd-outer-layer-reexports-domain-type-not-duplicates
type: pattern
topic: general
perspective: the-coder
created: 1787923531.837056
---

Feedback: in capability-centric DDD, when an outer-layer composition-root file (e.g. src/app/app-state.ts) has a placeholder field/type predating a capability's domain implementation (e.g. a HammerMode union type stubbed early as a TODO), once the capability's domain layer defines the canonical type, make the outer-layer file re-export it (`export type { HammerMode } from '<capability>/domain/...'`) rather than keep its own separate declaration. The outer layer (app/, composition root) is allowed to import a capability's domain types — that's the correct dependency direction (domain ← application ← infrastructure ← ui/app) — but the domain module must never import back from app/. This avoids two competing definitions of the same domain concept drifting apart, and keeps the domain layer as the single source of truth for its own vocabulary even when a placeholder was born in an outer layer first.