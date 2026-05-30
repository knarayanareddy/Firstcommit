import * as vscode from 'vscode';
import { listMyPacks } from './api';
import { getAuthHeader } from './auth';
import { PackSummary } from './types';

let cachedPacks: { at: number; packs: PackSummary[] } | null = null;
let statusBarItem: vscode.StatusBarItem;

export function setupStatusBar(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'rocketboard.selectPack';
    context.subscriptions.push(statusBarItem);
    updateStatusBarFromState(context);
}

/**
 * Returns the currently selected packId and packTitle from configuration or workspaceState.
 */
export function getSelectedPack(context: vscode.ExtensionContext): { packId: string | null; packTitle: string | null } {
    const config = vscode.workspace.getConfiguration('rocketboard');
    let packId = config.get<string>('packId') || null;
    
    if (!packId) {
        packId = context.workspaceState.get<string>('rocketboard.packId') || null;
    }
    
    const packTitle = context.workspaceState.get<string>('rocketboard.packTitle') || null;
    
    return { packId, packTitle };
}

/**
 * Persists the selected packId and packTitle to workspaceState and configuration.
 */
export async function setSelectedPack(context: vscode.ExtensionContext, packId: string, packTitle: string): Promise<void> {
    // 1. Persist to workspaceState (fast, isolated fallback)
    await context.workspaceState.update('rocketboard.packId', packId);
    await context.workspaceState.update('rocketboard.packTitle', packTitle);
    
    // 2. Persist to workspace configuration (visible, shareable if workspace settings checked in)
    const config = vscode.workspace.getConfiguration('rocketboard');
    try {
        await config.update('packId', packId, vscode.ConfigurationTarget.Workspace);
    } catch (e) {
        console.warn('Could not update workspace configuration packId', e);
    }
}

export function updateStatusBarFromState(context: vscode.ExtensionContext) {
    const { packId, packTitle } = getSelectedPack(context);
    
    if (!packId) {
        statusBarItem.text = `$(rocket) RocketBoard: Select pack`;
        statusBarItem.tooltip = 'Select a pack to ground explanations';
    } else {
        const label = packTitle || packId.substring(0, 8);
        statusBarItem.text = `$(rocket) RocketBoard: ${label}`;
        statusBarItem.tooltip = 'Click to change grounded pack';
    }
    statusBarItem.show();
}

export async function getPackId(context: vscode.ExtensionContext): Promise<string | undefined> {
    const { packId } = getSelectedPack(context);
    return packId || undefined;
}

export async function selectPackCommand(context: vscode.ExtensionContext) {
    const authHeader = await getAuthHeader(context);
    if (!authHeader) {
        const setRes = await vscode.window.showErrorMessage('RocketBoard token is missing.', 'Set Token');
        if (setRes === 'Set Token') {
            vscode.commands.executeCommand('rocketboard.setToken');
        }
        return;
    }
    
    const config = vscode.workspace.getConfiguration('rocketboard');
    const supabaseUrl = config.get<string>('supabaseUrl');
    if (!supabaseUrl) {
        vscode.window.showErrorMessage('RocketBoard: "rocketboard.supabaseUrl" configuration is required in settings.');
        return;
    }

    // Try cache first (5 min TTL)
    const now = Date.now();
    let packs: PackSummary[] = [];
    
    if (cachedPacks && now - cachedPacks.at < 5 * 60 * 1000) {
        packs = cachedPacks.packs;
    } else {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "RocketBoard: Fetching your packs...",
                cancellable: false
            }, async () => {
                packs = await listMyPacks({ supabaseUrl, token: authHeader });
                cachedPacks = { at: now, packs };
            });
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to fetch packs: ${err.message}`);
            return;
        }
    }
    
    if (packs.length === 0) {
        vscode.window.showInformationMessage("You don't have access to any RocketBoard packs.");
        return;
    }
    
    const items: vscode.QuickPickItem[] = packs.map(p => ({
        label: p.title,
        description: p.access_level,
        detail: p.description || `Org ID: ${p.org_id}`,
        pack_id: p.pack_id // custom payload field
    }));
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a RocketBoard pack to ground against',
        matchOnDescription: true,
        matchOnDetail: true
    });
    
    if (selected) {
        const packId = (selected as any).pack_id;
        const packTitle = selected.label;
        
        await setSelectedPack(context, packId, packTitle);
        updateStatusBarFromState(context);
        
        vscode.window.showInformationMessage(`RocketBoard pack set to "${packTitle}"`);
    }
}
