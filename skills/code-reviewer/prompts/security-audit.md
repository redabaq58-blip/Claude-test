# Security Audit Prompt Template

```
Perform a security audit of the following code:

{{code}}

Focus on:
1. OWASP Top 10 vulnerabilities
2. Authentication and authorization issues
3. Input validation and sanitization
4. Hardcoded secrets or credentials
5. Dependency vulnerabilities (flag any suspicious imports)
6. Data exposure risks
7. Injection vulnerabilities (SQL, command, XSS)

For each finding:
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- Location: file/line if available
- Description: what the vulnerability is
- Exploit scenario: how could this be abused
- Remediation: how to fix it with example code

End with: overall security posture assessment.
```
