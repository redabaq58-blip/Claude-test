title: Refactor Code
description: Refactor code for clarity, performance, and maintainability
model: claude-sonnet-4-6
tags: coding, refactoring, quality
---
Refactor the following code to improve its quality:

**Language:** {{language}}
**Goal of refactoring:** {{goal}}

**Code to refactor:**
```
{{code}}
```

Refactoring priorities (in order):
1. **Correctness** — fix any bugs found during refactoring
2. **Readability** — clearer naming, better structure, meaningful comments
3. **Simplicity** — remove unnecessary complexity, DRY up duplication
4. **Performance** — fix obvious inefficiencies (but don't over-optimize)
5. **Testability** — make code easier to test

Provide:
1. **Refactored code** — the improved version
2. **Change summary** — bullet list of what changed and why
3. **Breaking changes** — anything that changes the public interface
4. **What was NOT changed** — important things preserved intentionally

Keep the same functionality — this is a refactor, not a rewrite.
