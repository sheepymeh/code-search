import { window, workspace, Uri, SymbolKind, SymbolInformation } from 'vscode';
import { minimatch } from 'minimatch'; // https://github.com/microsoft/vscode-discussions/discussions/719
import { basename } from 'path';

export function getConfig<T>(
	name: string,
): T {
	return workspace.getConfiguration('code-search').get(name) as T;
}

export function getBatchSizeAndApi(
	workspaceFolder: string,
): [number, string] {
	const batchSize: number = getConfig('embeddings.batchSize');
	const api = [
		getConfig('backend'),
		getConfig('embeddings.model'),
		basename(workspaceFolder),
	].join('/');
	return [batchSize, api];
}

export function fileFilter(
	uri: Uri,
): boolean {
	const fsPath = workspace.asRelativePath(uri.fsPath, false);
	return (
		minimatch(fsPath, getConfig('include')) &&
		!minimatch(fsPath, getConfig('exclude'))
	);
}

const validSymbols = [SymbolKind.Class, SymbolKind.Function, SymbolKind.Method];
export function isValidSymbol(symbol: SymbolInformation): boolean {
	return (
		validSymbols.includes(symbol.kind) &&
		!symbol.location.range.isEmpty
	);
}

export function expandFilterSymbols(symbols: SymbolInformation[]): SymbolInformation[] {
	const expanded: SymbolInformation[] = [];
	for (const symbol of symbols) {
		if (symbol.children.length) {
			expanded.push(...expandFilterSymbols(symbol.children));
		}
		if (isValidSymbol(symbol)) {
			expanded.push(symbol);
		}
	}
	return expanded;
}

export async function fetchApi<T>(
	api: string,
	endpoint: string,
	method: 'OPTIONS' | 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' = 'GET',
	body: any = undefined,
): Promise<T> {
	try {
		const req = await fetch(`${api}${endpoint ? '/' : ''}${endpoint}`, {
			method: method,
			headers: { 'Content-Type': 'application/json', },
			body: body === 'undefined' ? undefined : JSON.stringify(body),
		});
		if (req.status !== 200) {
			window.showErrorMessage(`Failed to fetch ${api}: ${req.statusText}`);
			throw new Error(`Failed to fetch ${api}: ${req.statusText}`);
		}
		return req.json() as T;
	}
	catch (err) {
		if (err instanceof TypeError) {
			window.showErrorMessage(`Could not connect to server. Is it running at ${api}?`);
			throw new Error(`Failed to fetch ${api}: ${err.message}`);
		}
		else { throw err; }
	}
}

export async function sleep(
	ms: number,
): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}