# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (`main`) | Yes |
| older branches  | No  |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, email the maintainers directly or open a [GitHub private security advisory](https://github.com/redabaq58-blip/Claude-test/security/advisories/new).

We aim to respond within 72 hours and will work with you on a coordinated disclosure.

## Known Risks / Threat Model

ClaudeForge ships powerful tool surfaces that **must not be exposed to the public internet without additional controls**:

### Tool Execution

- **Filesystem MCP** — can read and write files within configured `allowedPaths`. Do not set `allowedPaths` to sensitive directories.
- **Code MCP** — executes arbitrary Node.js, Python, and Bash in the host process. Deploy inside a container or sandbox; never expose publicly without auth.
- **Web MCP** — fetches arbitrary URLs. SSRF protections block private IP ranges but an allowlist is recommended for high-security deployments.
- **Git MCP** — can commit and push (when `readonly: false`). Restrict to read-only unless write access is explicitly required.

### API Authentication

By default, the API runs **without authentication** (local/internal use only). For any internet-facing deployment:

1. Set `API_SECRET=<strong-random-value>` in your environment.
2. All API clients must send `Authorization: Bearer <API_SECRET>`.

### CORS

Set `CORS_ORIGIN=https://your-dashboard.example.com` to restrict cross-origin access in production. Without this, the API rejects all cross-origin requests in production (good), but the value is open in development.

### Streaming Token Cost

Token costs shown for streaming responses are **estimates** (~4 chars per token). Actual costs may differ. Set `COST_LIMIT_PER_RUN` to cap spending.

## Dependency Security

Run `npm audit` regularly. The project pins dependencies via `package-lock.json`.
