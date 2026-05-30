# RocketBoard — Local Ollama Setup Runbook

This guide explains how to configure a local Ollama instance to serve as a high-availability fallback for the RocketBoard RAG pipeline.

## 1. Install and Start Ollama

1.  **Download Ollama**: Visit [ollama.com](https://ollama.com) and install the application for your OS.
2.  **Pull Preferred Model**: Open your terminal and pull the default fallback model (Llama 3):
    ```bash
    ollama pull llama3
    ```
3.  **Ensure Service is Running**: By default, Ollama runs on `127.0.0.1:11434`.

---

## 2. Configure Environment Variables

For the `ai-task-router` to reach your local service, you must configure the following environment variables in your Supabase configuration (`.env` or via `supabase secrets set`).

### Required Variables
| Variable | Value (Local Dev) | Description |
| :--- | :--- | :--- |
| `ENABLE_OLLAMA_FALLBACK` | `true` | Must be set to `true` to activate the fallback logic. |
| `OLLAMA_ENDPOINT` | `http://host.docker.internal:11434/v1/chat/completions` | The internal Docker bridge address to reach your host's Ollama service. |

### Optional Variables
| Variable | Default | Description |
| :--- | :--- | :--- |
| `OLLAMA_MODEL` | `llama3` | The model name you pulled in Step 1. |
| `ALLOW_PRIVATE_OLLAMA` | `false` | Set to `true` if you are using a private IP literal instead of `localhost`/`host.docker.internal`. |

---

## 3. Security Considerations

### Local Mode (Development)
The system automatically detects if it is running in a local Deno environment (via `DENO_REGION`).
- Allowed Hosts: `localhost`, `host.docker.internal`.
- Allowed Protocols: `http`, `https`.
- Private IPs: Blocked by default. Set `ALLOW_PRIVATE_OLLAMA="true"` to allow raw IP literals like `192.168.1.10`.

### Cloud Mode (Staging/Production)
In cloud environments, security is strictly enforced:
- **HTTPS Required**: Rejects all HTTP endpoints.
- **No Private Access**: Rejects `localhost`, `host.docker.internal`, and all private/reserved IP ranges.
- **Host Allowlist**: The host must be a public domain name.

---

## 4. Troubleshooting

- **Connection Refused**: Ensure Ollama is running and that you are using `host.docker.internal` if running the Supabase Edge Functions via Docker `supabase start`.
- **Validation Failed**: Check the console logs for `[FALLBACK] Ollama skipped or failed validation`. If you see "private network access forbidden", verify your `ALLOW_PRIVATE_OLLAMA` setting.
- **Not Triggering**: Ensure `ENABLE_OLLAMA_FALLBACK` is exactly `"true"` and that you have triggered a fallback condition (e.g., exhaustion of Lovable credits or a 500 error from a commercial provider).
