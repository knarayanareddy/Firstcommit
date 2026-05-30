import * as vscode from 'vscode';
import * as path from 'path';

export interface SourceSpan {
    span_id: string; // e.g., "S1"
    path: string;
    start_line?: number;
    end_line?: number;
}

export async function handleCitationClick(badge: string, sourceMap: SourceSpan[]) {
    // Parse the badge "S1"
    const spanId = badge.replace(/[\[\]]/g, '');
    const span = sourceMap.find(s => s.span_id === spanId);
    
    if (!span) {
        vscode.window.showWarningMessage(`Citation [${badge}] not found in source map.`);
        return;
    }
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace open to locate the file.');
        return;
    }

    // ─── Phase 3: Cross-Repo Source Mapping ───
    const config = vscode.workspace.getConfiguration('rocketboard');
    const sourceMappings = config.get<Record<string, string>>('sourceMappings') || {};
    
    // Parse slug from path (format: "slug/path/to/file")
    const pathParts = span.path.split('/');
    const slug = pathParts.length > 1 ? pathParts[0] : null;
    const relativePath = slug ? pathParts.slice(1).join('/') : span.path;
    
    let foundUri: vscode.Uri | null = null;
    let mappedFolder: vscode.WorkspaceFolder | undefined;

    // 1. Try to find via existing mapping
    if (slug && sourceMappings[slug]) {
        const mapping = sourceMappings[slug];
        for (const folder of workspaceFolders) {
            const potentialPath = path.isAbsolute(mapping) 
                ? path.join(mapping, relativePath)
                : path.resolve(folder.uri.fsPath, mapping, relativePath);
            
            try {
                const uri = vscode.Uri.file(potentialPath);
                await vscode.workspace.fs.stat(uri);
                foundUri = uri;
                break;
            } catch {}
        }
    }

    // 2. If no mapping or mapping failed, try searching all workspace folders
    if (!foundUri) {
        for (const folder of workspaceFolders) {
            const resolvedPath = path.resolve(folder.uri.fsPath, relativePath);
            try {
                const uri = vscode.Uri.file(resolvedPath);
                await vscode.workspace.fs.stat(uri);
                foundUri = uri;
                mappedFolder = folder;
                break;
            } catch {}
        }
    }

    // 3. Fallback: Prompt user to map the slug to a workspace folder
    if (!foundUri && slug) {
        const pick = await vscode.window.showQuickPick(
            workspaceFolders.map(f => ({ label: f.name, folder: f, description: f.uri.fsPath })),
            { placeHolder: `Source "${slug}" not mapped. Select the local folder for this repository:` }
        );

        if (pick) {
            const newMappings = { ...sourceMappings, [slug]: '.' }; // Default to root of selected folder
            // In a real scenario we'd calculate the relative path if they picked a subfolder, 
            // but for v1 we just map the slug to the workspace folder.
            await config.update('sourceMappings', newMappings, vscode.ConfigurationTarget.Workspace);
            
            const resolvedPath = path.resolve(pick.folder.uri.fsPath, relativePath);
            try {
                const uri = vscode.Uri.file(resolvedPath);
                await vscode.workspace.fs.stat(uri);
                foundUri = uri;
            } catch {
                vscode.window.showErrorMessage(`File still not found at ${resolvedPath} after mapping.`);
            }
        }
    }
    
    if (!foundUri) {
        const result = await vscode.window.showWarningMessage(
            `Could not find local file: ${relativePath}${slug ? ` (Source: ${slug})` : ''}`, 
            'Copy Citation', 
            'Copy Filepath'
        );
        if (result === 'Copy Citation') vscode.env.clipboard.writeText(`[${badge}]`);
        if (result === 'Copy Filepath') vscode.env.clipboard.writeText(span.path);
        return;
    }
    
    // Open the document and reveal the referenced range
    const document = await vscode.workspace.openTextDocument(foundUri);
    const editor = await vscode.window.showTextDocument(document);
    
    // Coordinate clamping and sanity checking bounds
    const startL = Math.max(1, span.start_line || 1);
    const endL = Math.max(startL, span.end_line || startL);
    
    // SECURITY: Enforce reasonable bounds limits (max 5000 lines)
    if (endL - startL > 5000) {
        vscode.window.showErrorMessage(`Security Error: Citation range unexpectedly large (${endL - startL} lines).`);
        return;
    }
    
    const startLine = startL - 1;
    const endLine = endL - 1;
    
    const maxLineObj = document.lineCount > 0 ? document.lineAt(Math.min(endLine, document.lineCount - 1)) : undefined;
    const range = new vscode.Range(startLine, 0, Math.min(endLine, document.lineCount - 1), maxLineObj ? maxLineObj.text.length : 0);
    
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}
