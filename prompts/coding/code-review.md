title: Code Review
description: Comprehensive code review covering security, bugs, performance, and style
model: claude-opus-4-6
tags: coding, review, security
---
Please review the following code:

**Context:** {{context}}
**Language/Framework:** {{language}}

```
{{code}}
```

## Review Checklist

### 🔴 CRITICAL (blocking issues)
Security vulnerabilities, data loss risks, or logic errors that break core functionality.

### 🟠 HIGH (should fix before shipping)
Bugs, significant performance issues, missing error handling.

### 🟡 MEDIUM (fix in next iteration)
Code smells, mild inefficiencies, unclear naming, missing tests.

### 🟢 LOW (nice to have)
Style improvements, minor optimizations, optional enhancements.

### ✅ What's Done Well
Acknowledge good patterns and practices.

## Security Checklist
- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all user-controlled data
- [ ] SQL/command injection prevention
- [ ] Auth checks on sensitive operations
- [ ] Dependency risks

## Verdict
**APPROVE** / **REQUEST_CHANGES** / **NEEDS_DISCUSSION**

One sentence explaining the verdict.
