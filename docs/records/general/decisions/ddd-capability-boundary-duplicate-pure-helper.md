id: ddd-capability-boundary-duplicate-pure-helper
type: pattern
topic: general
perspective: the-coder
created: 1787920663.725339
---

Feedback: when a capability-centric DDD plan explicitly forbids cross-capability domain imports (to allow parallel worktree development / avoid merge conflicts), a small pure helper needed by two capabilities (e.g. a cents/ratio formula) should be duplicated locally in each capability's domain layer rather than imported or hoisted to a shared-kernel prematurely. Mark the duplication with a one-line comment explaining it's deliberate decoupling, not an oversight, so a later reviewer doesn't 'fix' it into a cross-import. Only promote to shared-kernel once a third real use case demands it (matches the project's own 'no premature abstraction, extract on the fourth case' rule).