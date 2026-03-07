title: Write Tests
description: Generate comprehensive tests for any function or module
model: claude-sonnet-4-6
tags: coding, testing, quality
---
Write comprehensive tests for the following code:

**Testing framework:** {{framework}}
**Language:** {{language}}

**Code to test:**
```
{{code}}
```

Generate tests that cover:
1. **Happy path** — normal expected usage
2. **Edge cases** — boundary values, empty inputs, maximum values
3. **Error cases** — invalid input, missing required fields, type errors
4. **Integration scenarios** — how this interacts with dependencies (mock where needed)

For each test:
- Use descriptive test names that explain what's being tested and why it should pass
- Follow AAA pattern: Arrange, Act, Assert
- Include comments explaining non-obvious test logic

Also provide:
- **Coverage analysis** — what's tested and what's intentionally omitted and why
- **Missing tests** — what additional tests would add value if time permits
