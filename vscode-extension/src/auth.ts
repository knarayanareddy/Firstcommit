import * as vscode from 'vscode';

export const TOKEN_KEY = 'rocketboard.token';

export async function setToken(context: vscode.ExtensionContext) {
    const token = await vscode.window.showInputBox({
        prompt: 'Enter your Supabase JWT or RocketBoard PAT',
        password: true,
        ignoreFocusOut: true,
    });
    
    if (token) {
        await context.secrets.store(TOKEN_KEY, token.trim());
        vscode.window.showInformationMessage('RocketBoard token saved successfully.');
    }
}

export async function clearToken(context: vscode.ExtensionContext) {
    await context.secrets.delete(TOKEN_KEY);
    vscode.window.showInformationMessage('RocketBoard token cleared.');
}

export async function getToken(context: vscode.ExtensionContext): Promise<string | undefined> {
    return context.secrets.get(TOKEN_KEY);
}

export async function getAuthHeader(context: vscode.ExtensionContext): Promise<string | undefined> {
    const token = await getToken(context);
    if (!token) return undefined;
    
    // Future expansion: Support varied PAT prefixes here
    return `Bearer ${token}`;
}
