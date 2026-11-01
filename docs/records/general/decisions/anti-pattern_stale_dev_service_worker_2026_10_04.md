id: anti-pattern_stale_dev_service_worker_2026_10_04
type: pattern
topic: general
created: 1791067532.967105
---

Rule: Register the service worker in production only and actively unregister it in dev
When: Setting up PWA service workers
Why: a stale dev service worker previously caused confusing 'my change isn't showing up' bugs (seen in an earlier project)