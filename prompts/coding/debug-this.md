title: Debug This Code
description: Find the bug, explain it, and provide a fix with tests
model: claude-sonnet-4-6
tags: coding, debugging, bugs
---
Help me debug this code:

**Language/Framework:** {{language}}

**What it should do:** {{expected_behavior}}

**What actually happens:** {{actual_behavior}}

**Error message (if any):** {{error_message}}

**Code:**
```
{{code}}
```

Please:
1. **Identify the root cause** — what is actually wrong and why
2. **Explain the bug** — in plain terms, what is happening vs what should happen
3. **Provide the fix** — corrected code with changes clearly marked
4. **Explain the fix** — why this solution works
5. **Suggest a test** — a quick test to verify the fix works
6. **Prevent future bugs** — is there a pattern to avoid this class of bug?
