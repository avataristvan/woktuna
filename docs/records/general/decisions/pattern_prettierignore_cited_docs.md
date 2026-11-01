id: pattern_prettierignore_cited_docs
type: pattern
topic: general
perspective: agent
created: 1787925056.230497
---

Rule: Before the first `prettier --write` (or any auto-formatter) run in a repo, check whether any document is cited by section number/anchor elsewhere (code comments, CLAUDE.md, docs) and exclude it in `.prettierignore` (or equivalent) if so.
When: Any code project using an auto-formatter (Prettier or similar) that also has a reference/domain document cited by section anchors (e.g. §2.1, §5) from code comments or other docs.
Why: Auto-formatting a prose/markdown doc can silently rewrite its structure (e.g. bullet/heading changes shifted a 129-line diff in one observed case) and break the section-number citations other files depend on — the doc's exact anchors matter more than its formatting style.