id: the-coder_check_render_loop_before_rehook
type: pattern
topic: general
perspective: the-coder
created: 1787925760.899887
---

Rule: When wiring a new live-reactive UI parameter into an app with an existing render/tick loop, check whether that loop already re-reads mutable state fresh each iteration before assuming you need to add an explicit re-render/re-resolve trigger.
When: Any app with a rAF/game-loop/polling-style render cycle where a use-case or state object is queried fresh every frame (e.g. `selectScale.nearestTargetFor()` called inside `tick()` rather than cached).
Why: Adding an unnecessary explicit re-render hook duplicates control flow the loop already provides, and the answer to "does this need a hook" is empirically checkable by reading the loop's body rather than assumed from the change's surface area.