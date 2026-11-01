id: learning_scaffold_into_scratch_dir
type: pattern
topic: general
created: 1787920470.890174
---

When scaffolding a Vite project into a non-empty target directory that already has unrelated tracked files (.git, .gitignore, existing docs), `npm create vite@latest . -- --template X` has no clean non-interactive force-overwrite for that case. Working pattern: scaffold into a scratch temp dir, then `mv` the generated files into the target, leaving pre-existing files untouched. Fast since it's just a move.