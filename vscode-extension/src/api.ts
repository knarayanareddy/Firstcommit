import * as vscode from 'vscode';
import { PackSummary } from './types';

export interface ListMyPacksParams {
    supabaseUrl: string;
    token: string;
    timeoutMs?: number;
}

export async function listMyPacks({ supabaseUrl, token, timeoutMs = 15000 }: ListMyPacksParams): Promise<PackSummary[]> {
    const url = `${supabaseUrl}/functions/v1/list-my-packs`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            handleFriendlyError(res.status);
            throw new Error(`Backend error (${res.status})`);
        }
        
        const data = await res.json();
        return data.packs || [];
    } catch (err: any) {
        if (err.name === 'AbortError') {
            throw new Error('Request timed out while connecting to RocketBoard.');
        }
        throw err;
    }
}

export interface RetrieveSpansParams {
    supabaseUrl: string;
    token: string;
    packId: string;
    query: string;
    maxSpans: number;
    timeoutMs?: number;
}

export async function retrieveSpans({ supabaseUrl, token, packId, query, maxSpans, timeoutMs = 30000 }: RetrieveSpansParams) {
    const url = `${supabaseUrl}/functions/v1/retrieve-spans`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pack_id: packId, query, max_spans: maxSpans }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            handleFriendlyError(res.status);
            throw new Error(`Backend error (${res.status})`);
        }
        return res.json();
    } catch (err: any) {
        if (err.name === 'AbortError') {
            throw new Error('Request timed out while connecting to RocketBoard.');
        }
        throw err;
    }
}

export interface RunGlobalChatParams {
    supabaseUrl: string;
    token: string;
    envelope: any;
    timeoutMs?: number;
}

export async function runGlobalChat({ supabaseUrl, token, envelope, timeoutMs = 30000 }: RunGlobalChatParams) {
    const url = `${supabaseUrl}/functions/v1/ai-task-router`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(envelope),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            handleFriendlyError(res.status);
            throw new Error(`Backend error (${res.status})`);
        }
        return res.json();
    } catch (err: any) {
        if (err.name === 'AbortError') {
            throw new Error('Request timed out while connecting to RocketBoard.');
        }
        throw err;
    }
}

function handleFriendlyError(status: number) {
    if (status === 401) {
        throw new Error('Token invalid or expired. Please run "RocketBoard: Set token" again.');
    }
    if (status === 403) {
        throw new Error("You don't have access to this pack. Please verify your packId setting.");
    }
    if (status === 429) {
        throw new Error('Rate limited—please wait a moment and try again.');
    }
    if (status >= 500) {
        throw new Error('RocketBoard backend error. Please try again later.');
    }
}
