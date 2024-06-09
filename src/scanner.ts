import * as vscode from 'vscode';
import { QuerySymbol } from './types';
import { embeddingsInference } from './api';
import { getConfig, getBatchSizeAndApi, expandFilterSymbols } from './utils';

export async function scanFiles(
	include: string,
	exclude: string,
	maxIndexedFiles: number,
	updatedTimes: Record<string, number>,
): Promise<vscode.Uri[]> {
	// https://github.com/microsoft/vscode/issues/48674
	let files = await vscode.workspace.findFiles(include, exclude);
	if (files.length === 0) { return []; }
	if (maxIndexedFiles) {
		if (files.length > maxIndexedFiles) {
			vscode.window.showWarningMessage(`Indexing only the first ${maxIndexedFiles} files`);
			files = files.slice(0, maxIndexedFiles);
		}
	}

	const fileFilter = await Promise.all(files.map(async file =>
		((await vscode.workspace.fs.stat(file)).mtime) > (updatedTimes[vscode.workspace.asRelativePath(file, false)] ?? 0)
	));
	files = files.filter((_, i) => fileFilter[i]);
	return files;
}

export async function scanSymbols(
	files: vscode.Uri[],
): Promise<Record<string, QuerySymbol>> {
	let queries: Record<string, QuerySymbol> = {};

	for (const file of files) {
		let symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>('vscode.executeDocumentSymbolProvider', file);
		if (!symbols) { continue; }
		symbols = expandFilterSymbols(symbols);

		const filePath = vscode.workspace.asRelativePath(file, false);
		const readData = await vscode.workspace.fs.readFile(file);
		const fileContents = Buffer.from(readData).toString('utf8').split(/\r?\n/);

		for (const symbol of symbols) {
			if (symbol.location.uri.fsPath !== file.fsPath) { continue; }
			const name: string = symbol.name;
			const contents = fileContents.slice(symbol.location.range.start.line, symbol.location.range.end.line + 1).join('\n');
			if (symbol.location.range.isSingleLine) {
				const contentsTrimmed = contents.trim();
				if (contentsTrimmed.startsWith('import') || contentsTrimmed.startsWith('from')) { continue; }
			}

			queries[`${filePath}:${name}`] = {
				name,
				kind: symbol.kind,
				file: filePath,
				contents: contents,
				// symbol container handling?
			};
		}
	}
	return queries;
}

export async function scanAll(
	workspaceFolder: string,
	context: vscode.ExtensionContext,
): Promise<void> {
	console.info('Scanning all files...');
	const [batchSize, api] = getBatchSizeAndApi(workspaceFolder);

	let lastScan: Record<string, number> = context.workspaceState.get('lastScan', {});
	const files = await scanFiles(
		getConfig('include'),
		getConfig('exclude'),
		getConfig('maxIndexedFiles'),
		lastScan,
	);
	console.info(`Found ${files.length} files`);

	for (const file of files) { // possible race condition
		lastScan[vscode.workspace.asRelativePath(file, false)] = Date.now();
	}

	const queries = await scanSymbols(files);
	console.info(`Found ${Object.keys(queries).length} symbols`);

	await embeddingsInference(api, batchSize, queries);

	await context.workspaceState.update('lastScan', lastScan);
}