id: learning_worktree_cwd_isolation
type: pattern
topic: general
created: 1787920873.058536
---

When a the-coder agent runs in isolation:"worktree" mode, the task prompt's stated project path is the main checkout, but the agent's actual working directory is the worktree path. Write/Edit tool calls fail with an explicit isolation error until the agent resolves `pwd` first and operates relative to the worktree, not the main-repo path named in the prompt. Worth a one-line reminder in future worktree-isolated coder prompts.