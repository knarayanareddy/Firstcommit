# RocketBoard VS Code Extension — Maintainers Guide

This document describes the technical internals, architecture, and maintenance workflows for the RocketBoard VS Code extension.

## Repository Layout

- `src/extension.ts`: Main entry point, command registration, and high-level orchestration of the "Explain selection" flow.
- `src/packPicker.ts`: Logic for fetching and selecting grounded packs. Manages status bar updates and state persistence.
- `src/auth.ts`: Token management using VS Code's `SecretStorage`.
- `src/api.ts`: Low-level network interaction with Supabase Edge Functions. Handles timeouts and common error codes.
- `src/citations.ts`: Parser and resolver for `[S#]` citations. Maps backend source spans to local workspace files.
- `src/webview.ts`: Setup and configuration of the side-panel webview (CSP, HTML templates).
- `src/webview/main.ts`: Frontend-side logic within the webview (React-less). Handles markdown rendering (marked) and sanitization (DOMPurify).

---

## State & Persistence

### Workspace Configuration (`rocketboard.*`)
- `rocketboard.supabaseUrl`: The core backend URL.
- `rocketboard.packId`: The active pack UUID (defaults to empty).
- `rocketboard.maxSelectionChars`, `rocketboard.includeContextLines`, `rocketboard.requestTimeoutMs`: Tuning parameters.

### Workspace State (`context.workspaceState`)
- `rocketboard.packId`: Fallback storage for the active pack ID when settings are not checked in.
- `rocketboard.packTitle`: Friendlier name of the active pack (used for UI display).

### Secret Storage (`context.secrets`)
- `rocketboard.token`: Secured API token (JWT or PAT).

---

## Network & API Integration

The extension communicates with three primary Supabase Edge Functions:

### 1. `GET /functions/v1/list-my-packs`
- **Purpose**: Fetch available packs for the user.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `{ packs: PackSummary[] }`

### 2. `POST /functions/v1/retrieve-spans`
- **Purpose**: Retrieve relevant evidence for the selection.
- **Request**:
  ```json
  {
    "pack_id": "uuid",
    "query": "Explain...",
    "max_spans": 10
  }
  ```
- **Response**: `{ spans: SourceSpan[] }`

### 3. `POST /functions/v1/ai-task-router`
- **Purpose**: Generate the grounded explanation.
- **Request (Envelope)**:
  ```json
  {
    "task": { "type": "global_chat", "request_id": "...", "timestamp_iso": "..." },
    "pack": { "pack_id": "uuid" },
    "context": { "conversation": { "messages": [{ "role": "user", "content": "..." }] } },
    "retrieval": { "query": "...", "evidence_spans": [...] },
    "limits": { "max_chat_words": 400 }
  }
  ```
- **Response**:
  ```json
  {
    "display_response": "Markdown response...",
    "source_map": [ { "span_id": "S1", "path": "src/file.ts", "start_line": 10, "end_line": 20 } ]
  }
  ```

---

## Technical Internals

### Webview Rendering
- Uses a Strict Content Security Policy (CSP) with a nonce.
- Markdown is parsed by `marked` and sanitized by `DOMPurify`.
- Citations `[S1]` are replaced by `<a class="citation-link" data-badge="S1">` during rendering.
- Click events on citation links post a message `openCitation` back to the extension.

### Citation Mapping Logic (`handleCitationClick`)
1. Receives a badge identifier (e.g., "S1").
2. Identifies the `SourceSpan` from the `source_map` returned by the backend.
3. Iteratively attempts to resolve the span's `path` across all open workspace folders.
4. Uses `vscode.workspace.fs.stat` to verify file existence.
5. If found, opens the document and reveals the line range with coordinate clamping.
6. **Security**: Checks that the resolved path is within the workspace root and the line range is within a reasonable bound (5000 lines max).

---

## Development and Extensibility

### Local Development
To point the extension to a local Supabase instance:
1. Update `rocketboard.supabaseUrl` to `http://127.0.0.1:54321`.
2. Ensure you have the Supabase CLI running.

### Testing
- No unit test suite exists currently. Contributions are encouraged using the standard VS Code test runner.
- Use `npm run check-types` for basic sanity checks.

### Future Roadmap
- [ ] Support Personal Access Tokens (PATs) with custom headers.
- [ ] Add "Explain symbol under cursor" context menu.
- [ ] Implement multi-hop "Detective" loop (retrieving more evidence based on AI output).
- [ ] Better multi-root workspace handling.
