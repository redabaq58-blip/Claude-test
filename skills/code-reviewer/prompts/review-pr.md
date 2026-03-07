# PR Review Prompt Template

```
Please review the following pull request diff:

Title: {{pr_title}}
Description: {{pr_description}}

Diff:
{{diff}}

Provide a structured code review covering:
1. Summary of changes (what this PR does)
2. Critical issues (🔴 blocking)
3. High priority issues (🟠 should fix)
4. Medium/Low issues (🟡🟢 suggestions)
5. Security checklist results
6. Overall verdict: APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION

Be constructive and specific. Reference line numbers where possible.
```
