import * as vscode from 'vscode';
import * as path from 'path';

export function createWebviewPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        'rocketboardExplanation',
        'RocketBoard: Explain Selection',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'dist'))]
        }
    );
    
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview.js')));
    const nonce = getNonce();
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>RocketBoard Explanation</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 1.5rem;
                    line-height: 1.6;
                }
                .loading { font-style: italic; color: var(--vscode-descriptionForeground); margin-top: 2rem; }
                .error { color: var(--vscode-errorForeground); padding: 1rem; border: 1px solid var(--vscode-errorForeground); border-radius: 4px; margin-top: 1rem; }
                a.citation-link {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                    cursor: pointer;
                    font-weight: 600;
                    margin: 0 2px;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 0 4px;
                    border-radius: 3px;
                    font-size: 0.85em;
                }
                a.citation-link:hover { opacity: 0.8; }
                pre { background-color: var(--vscode-textCodeBlock-background); padding: 1rem; border-radius: 4px; overflow-x: auto; }
                code { font-family: var(--vscode-editor-font-family); font-size: 0.9em; }
                h1, h2, h3 { color: var(--vscode-editor-foreground); border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 4px; }
            </style>
        </head>
        <body>
            <div id="content"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>
    `;
    
    return panel;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
