id: vite-scaffold-into-nonempty-dir
type: anti-pattern
topic: general
perspective: the-coder
created: 1787920396.948915
---

Tried: `npm create vite@latest . -- --template <t>` directly in a non-empty target directory (existing tracked files present).
Failed because: create-vite prompts/refuses on non-empty dirs even with --force flags being inconsistent across versions, and risks touching files that must survive untouched.
Instead: scaffold into a scratch temp dir (`npm create vite@latest <tmp-name> -- --template <t>`), then `mv` only the generated files (package.json, tsconfig.json, index.html, src/, public/) into the target dir, leaving pre-existing files (README, .gitignore, docs) untouched. Merge .gitignore contents manually rather than overwriting.