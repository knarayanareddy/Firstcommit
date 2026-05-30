# RocketBoard VS Code Extension

RocketBoard is a grounded AI coding assistant that explains your code selections using your own repository's context. It leverages a Zero-Hallucination RAG (Retrieval-Augmented Generation) system to provide accurate, cited explanations.

## Features

- **Explain Selection**: Select any block of code and get a detailed explanation, step-by-step flow, and dependency analysis.
- **Grounded AI**: Every claim is backed by evidence from your codebase.
- **Interactive Citations**: Clickable badges `[S1]`, `[S2]`, etc., that take you directly to the source file and line range.
- **Pack Selection**: Ground your explanations against specific project "packs" for targeted context.
- **Secure Token Storage**: Your authentication tokens are stored safely in VS Code's `SecretStorage`.

---

## Setup and Installation

### Prerequisites
- **VS Code**: Version 1.80.0 or higher.
- **Node.js**: Version 18.x or higher (required only for building from source).
- **Supabase Project**: You need access to a RocketBoard-compatible Supabase instance.

### Installation (Development / Build from Source)
Follow these steps to get the extension running in your local editor:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/knarayanareddy/rocketboard-ai-guide.git
   cd rocketboard-ai-guide/vscode-extension
   ```

2. **Install Dependencies**:
   Use `npm` to install the required packages (including `vscode` types and `esbuild`):
   ```bash
   npm install
   ```

3. **Build the Extension**:
   Compile the TypeScript source into the `dist/` folder:
   ```bash
   npm run compile
   ```

4. **Launch into Extension Development Host**:
   - Open the `vscode-extension` folder in VS Code.
   - Press `F5` or go to the **Run and Debug** view and click **Run Extension**.
   - A new VS Code window will open with the prefix `[Extension Development Host]`. The extension is active in this window.

### Detailed Configuration
The extension relies on several settings to communicate with the RocketBoard backend. You can find these in **File > Preferences > Settings** (or `Cmd/Ctrl + ,`) by searching for `@ext:RocketBoard.rocketboard-vscode`.

| Setting | Type | Default | Description |
|---|---|---|---|
| `rocketboard.supabaseUrl` | `string` | `""` | **Required.** The base URL of your Supabase project (e.g., `https://abcdefghijklm.supabase.co`). Ensure there is no trailing slash. |
| `rocketboard.packId` | `string` | `""` | The UUID of the specific pack you want to ground against. While this can be set manually, it is recommended to use the **Status Bar Picker** to set this. |
| `rocketboard.maxSelectionChars` | `number` | `8000` | Limits the amount of selected text sent to the AI. Helps stay within model context windows and reduce latency. |
| `rocketboard.includeContextLines`| `number` | `20` | The number of lines above and below your selection to include. This provides the AI with structural context (e.g., function headers, imports). |
| `rocketboard.requestTimeoutMs` | `number` | `30000` | How long to wait for the Edge Function to respond before failing. Increase this if you are on a slow network. |
| `rocketboard.trace` | `boolean` | `false` | Enable this to see verbose diagnostic information in the **Output** panel (if logging is implemented). |

---

## Authentication Detail

RocketBoard uses **Bearer Token** authentication to secure its Edge Functions.

### How to Retrieve your Token
1. Log in to your RocketBoard web dashboard.
2. Navigate to **User Settings** or **API Keys**.
3. Generate a **Personal Access Token (PAT)** or copy your **Session JWT**.

### Setting the Token
1. In VS Code, open the Command Palette (`Cmd/Ctrl+Shift+P`).
2. Type `RocketBoard: Set token` and press `Enter`.
3. Paste the token. The extension will automatically prefix it with `Bearer ` if necessary.
4. You should see a notification: `RocketBoard token saved successfully.`

### Security Architecture
- **In-Memory**: The token is never stored in plain text files within the `.vscode` folder.
- **SecretStorage**: We utilize the `vscode.secrets` API, which hooks into the underlying operating system's credential manager (Windows Credential Manager, macOS Keychain, or Linux libsecret/gnome-keyring).
- **Isolation**: Each workspace has its own configuration, but the token is shared across your VS Code profile.

---

## Workspace Integration

### Selecting a Grounded Pack
A "Pack" is a collection of knowledge sources (GitHub repos, docs, etc.). To get accurate explanations, the extension needs to know which pack to use for retrieval.

1. **The Status Bar**: Look at the bottom right of your VS Code window. You will see `$(rocket) RocketBoard: Select pack` or the name of a previously selected pack.
2. **The Flow**:
   - Click the status bar item.
   - A QuickPick menu will appear, fetching packs from your Supabase instance.
   - Select the pack that corresponds to your current project.
3. **Persistence**: The extension remembers your selection per workspace. Even if you restart VS Code, the pack name will persist in the status bar (using `workspaceState`).

### Explaining Code
1. **Highlight**: Select a block of code (e.g., a complex loop or a framework hook).
2. **Trigger**:
   - Command Palette: `RocketBoard: Explain selection`
   - Keyboard Shortcut: You can bind this to a key of your choice in **Keyboard Shortcuts**.
3. **Wait**: The status bar will show a spinner or loading state, and a side webview will open.
4. **Review**: Read the grounded explanation.

### 3. Navigation via Citations
- The explanation will contain badges like `[S1]`.
- Hovering over a badge (in future) or clicking it will open the corresponding source file in your workspace at the exact line range referenced by the AI.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Token invalid or expired` | Missing or incorrect token. | Run `RocketBoard: Set token` with a fresh token. |
| `You don't have access to this pack` | Pack ID is incorrect or you lack permissions. | Select a different pack or check your `packId` setting. |
| `missing "rocketboard.supabaseUrl"` | The backend URL is not configured. | Set `rocketboard.supabaseUrl` in VS Code settings. |
| `Request timed out` | Network issues or slow backend. | Check your connection or increase `rocketboard.requestTimeoutMs`. |
| `Security Error: Citation traversal` | A citation attempted to open a file outside the workspace. | This is a security block. Contact maintainers if the file is legitimate. |

---

## Privacy and Safety

- **Code Privacy**: Only the selected code and a small amount of surrounding context (default 20 lines) are sent to the backend. Your entire repository is NOT uploaded.
- **Sensitive Data**: Avoid selecting code that contains hardcoded secrets or PII.
- **Telemetry**: The extension may log basic usage metrics (if enabled) but never logs tokens or raw code.

---

## Development Scripts

- `npm run check-types`: Run TypeScript type checking.
- `npm run compile`: Build the extension using `esbuild`.
- `npm run watch`: Run the build in watch mode for development.
- `npm run package`: Build the production-ready extension package.
