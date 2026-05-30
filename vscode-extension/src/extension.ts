import * as vscode from 'vscode';
import { setToken, clearToken, getAuthHeader } from './auth';
import { retrieveSpans, runGlobalChat } from './api';
import { handleCitationClick, SourceSpan } from './citations';
import { createWebviewPanel } from './webview';
import { selectPackCommand, setupStatusBar, getPackId } from './packPicker';

function generateRequestId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('rocketboard.setToken', () => setToken(context)));
    context.subscriptions.push(vscode.commands.registerCommand('rocketboard.clearToken', () => clearToken(context)));
    context.subscriptions.push(vscode.commands.registerCommand('rocketboard.selectPack', () => selectPackCommand(context)));
    
    setupStatusBar(context);
    
    context.subscriptions.push(vscode.commands.registerCommand('rocketboard.explainSelection', async () => {
        const config = vscode.workspace.getConfiguration('rocketboard');
        const supabaseUrl = config.get<string>('supabaseUrl');
        
        if (!supabaseUrl) {
            vscode.window.showErrorMessage('RocketBoard: "rocketboard.supabaseUrl" configuration is required in settings.');
            return;
        }
        
        let packId = await getPackId(context);
        if (!packId) {
            await vscode.commands.executeCommand('rocketboard.selectPack');
            packId = await getPackId(context);
            if (!packId) return; // user cancelled selection
        }
        
        const authHeader = await getAuthHeader(context);
        if (!authHeader) {
            const setRes = await vscode.window.showErrorMessage('RocketBoard token is missing.', 'Set Token');
            if (setRes === 'Set Token') {
                vscode.commands.executeCommand('rocketboard.setToken');
            }
            return;
        }
        
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showWarningMessage('RocketBoard: Please select some code to explain.');
            return;
        }
        
        const maxChars = config.get<number>('maxSelectionChars') || 8000;
        let selectedText = editor.document.getText(editor.selection);
        if (selectedText.length > maxChars) {
            selectedText = selectedText.substring(0, maxChars) + '... [truncated]';
        }
        
        const filePathAbs = editor.document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        const filePathRel = workspaceFolder ? vscode.workspace.asRelativePath(editor.document.uri, false) : filePathAbs;
        
        const includeContextLines = config.get<number>('includeContextLines') || 20;
        const startLine = Math.max(0, editor.selection.start.line - includeContextLines);
        const endLine = Math.min(editor.document.lineCount - 1, editor.selection.end.line + includeContextLines);
        const contextLines = editor.document.getText(new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length));
        
        // Render webview to show loading state
        const panel = createWebviewPanel(context);
        panel.webview.postMessage({ type: 'renderState', state: 'loading' });
        
        try {
            // Keep the retrieval query focused on the core explanation goal
            const query = `Explain code selection from ${filePathRel}: ${selectedText.substring(0, 500)}`;
            
            // 1. Retrieve evidence
            const retrieveRes = await retrieveSpans({
                supabaseUrl,
                token: authHeader,
                packId,
                query,
                maxSpans: 10,
                timeoutMs: config.get<number>('requestTimeoutMs') || 30000
            });
            const spans = retrieveRes.spans || [];
            
            // 2. Call ai-task-router with a global_chat task
            const prompt = `Explain this selection from file \`${filePathRel}\`:\n\nSELECTED CODE:\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\`\n\nSURROUNDING CONTEXT:\n\`\`\`${editor.document.languageId}\n${contextLines}\n\`\`\`\n\nPlease provide a high-level summary, step-by-step flow, key dependencies, common pitfalls, and what you would change first. Cite factual claims using your grounding rules.`;
            
            const envelope = {
                task: { 
                    type: 'global_chat', 
                    request_id: generateRequestId(),
                    timestamp_iso: new Date().toISOString()
                },
                pack: { pack_id: packId },
                context: { 
                    conversation: { messages: [{ role: 'user', content: prompt }] } 
                },
                retrieval: { query, evidence_spans: spans },
                limits: { max_chat_words: 400 }
            };
            
            const routerRes = await runGlobalChat({
                supabaseUrl,
                token: authHeader,
                envelope,
                timeoutMs: config.get<number>('requestTimeoutMs') || 30000
            });
            
            const markdown = routerRes.display_response || routerRes.response_markdown || 'No response generated.';
            
            // Normalize source map to support backend variations
            const rawMap = routerRes.source_map || routerRes.referenced_spans || [];
            const sourceMap: SourceSpan[] = rawMap.map((s: any) => ({
                span_id: s.span_id || s.id,
                path: s.path || s.filepath,
                start_line: s.start_line || s.start,
                end_line: s.end_line || s.end
            }));
            
            // Send successful response to webview
            panel.webview.postMessage({
                type: 'renderState',
                state: 'success',
                markdown
            });
            
            // Listen for citation clicks with strict message validation
            panel.webview.onDidReceiveMessage(
                message => {
                    if (message && message.type === 'openCitation' && typeof message.badge === 'string') {
                        handleCitationClick(message.badge, sourceMap);
                    }
                },
                undefined,
                context.subscriptions
            );
            
        } catch (error: any) {
            panel.webview.postMessage({ type: 'renderState', state: 'error', error: error.message });
        }
    }));
}

export function deactivate() {}
