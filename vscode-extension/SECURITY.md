# RocketBoard VS Code Extension — Security Model

The RocketBoard VS Code extension is designed with security as a primary concern. This document outlines the threat model, implemented mitigations, and safe coding practices for future contributors.

## Threat Model

| Threat | Description | Mitigation |
|---|---|---|
| **Token Theft** | An attacker steals the Supabase JWT or RocketBoard PAT. | Use VS Code `SecretStorage` (which uses the OS keychain like macOS Keychain, Windows Credential Manager, or libsecret). |
| **Malicious Markdown** | AI-generated response contains a script to execute in the extension context. | **CSP**: Webview context is restricted with `default-src 'none'`. **DOMPurify**: All HTML is sanitized before being injected into the DOM. |
| **Path Traversal** | A malicious citation attempts to open a sensitive file outside the workspace. | **Workspace Root Validation**: Paths are resolved using `path.resolve` and checked to ensure they are within an active workspace folder. |
| **Excessive Range Disclosure** | A citation references an unusually large range of lines to overwhelm the editor or disclose extra context. | **Range Bounding**: Citations are capped to a maximum of 5000 lines. |

---

## Secure Coding Rules

To maintain the security posture of RocketBoard, all contributors MUST follow these rules:

1. **Strict Secret Handling**:
   - NEVER log authentication tokens, passwords, or raw user-selected code.
   - USE `vscode.secrets` for all sensitive persistence.
   - ALWAYS redact tokens in error messages.

2. **Webview Safety**:
   - NEVER use `innerHTML` without first sanitizing with `DOMPurify`.
   - USE a strong, random `nonce` for every script tag in the HTML template.
   - MAINTAIN the `Content-Security-Policy` with `default-src 'none'` and avoid `'unsafe-inline'` where possible.

3. **Workspace Isolation**:
   - ALWAYS validate that file operations (open, read, write) are restricted to the current workspace root.
   - REJECT any paths that attempt to use `..` traversal.

4. **External Fetches**:
   - ONLY fetch from the configured `rocketboard.supabaseUrl`.
   - USE `AbortController` to prevent long-running requests from hanging the extension.

---

## Infrastructure Security (Backend)

While the extension itself is a client, it assumes the following backend security invariants (from `AGENTS.md`):

- **SSRF Policy**: All outbound URLs from the backend are validated.
- **Secret Redaction**: Chunks are scanned for secrets during ingestion and retrieval.
- **Tenancy**: Data is isolated by `pack_id` within the database.
