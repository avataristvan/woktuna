id: domain_woktuna_capability_ddd_architecture_2026_10_04
type: domain
topic: general
created: 1791067532.967105
---

Decision: WokTuna uses capability-centric DDD + clean architecture (src/capabilities/<name>/ layered domain -> application -> infrastructure/presentation, dependencies pointing inward), per the user's standing convention
Why: domain has zero Web Audio/Canvas/DOM dependency, which makes the tuning-rule logic unit-testable and protects it as the actual differentiating IP
Scope: capabilities scale-configuration, tone-field-detection, tone-field-visualization; composition in app/bootstrap.ts and application/build-guidance.ts