import * as vscode from 'vscode';
import { getConfig, getBatchSizeAndApi, fileFilter, fetchApi, sleep } from './utils';
import { scanSymbols } from './scanner';
import { embeddingsInference } from './api';

let recentRenameDelete = new Set<string>();
let recentRenameCreate = new Set<string>();

async function saveHandler(
	uri: vscode.Uri,
	context: vscode.ExtensionContext,
	workspaceFolder: string,
	force: boolean = false,
): Promise<void> {
	await sleep(100);
	if (
		!fileFilter(uri) ||
		(!force && recentRenameCreate.has(uri.fsPath))
	) { return; }

	const [batchSize, api] = getBatchSizeAndApi(workspaceFolder);
	await fetchApi(api, vscode.workspace.asRelativePath(uri, false), 'DELETE'); // TODO: find symbols that remained unchanged to cache them
	let lastScan: Record<string, number> = context.workspaceState.get('lastScan', {});
	lastScan[vscode.workspace.asRelativePath(uri, false)] = Date.now();
	await context.workspaceState.update('lastScan', lastScan);
	const queries = await scanSymbols([uri]);
	await embeddingsInference(api, batchSize, queries);
}

async function renameHandler(
	event: vscode.FileRenameEvent,
	context: vscode.ExtensionContext,
	workspaceFolder: string,
): Promise<void> {
	const [_, api] = getBatchSizeAndApi(workspaceFolder);

	let promises: Promise<void>[] = [];
	for (const file of event.files) {
		recentRenameDelete.add(file.oldUri.fsPath);
		recentRenameCreate.add(file.newUri.fsPath);
		setTimeout(() => {
			recentRenameDelete.delete(file.oldUri.fsPath);
			recentRenameCreate.delete(file.newUri.fsPath);
		}, 200);

		const [oldUriIncluded, newUriIncluded] = [fileFilter(file.oldUri), fileFilter(file.newUri)];

		if (oldUriIncluded && newUriIncluded) {
			promises.push(fetchApi(
				api,
				vscode.workspace.asRelativePath(file.oldUri, false),
				'PUT',
				{ new_file_name: vscode.workspace.asRelativePath(file.newUri, false) }
			));
			let lastScan: Record<string, number> = context.workspaceState.get('lastScan', {});
			lastScan[vscode.workspace.asRelativePath(file.newUri, false)] = Date.now();
			delete lastScan[vscode.workspace.asRelativePath(file.oldUri, false)];
			await context.workspaceState.update('lastScan', lastScan);
		}
		else if (oldUriIncluded && !newUriIncluded) {
			promises.push(deleteHandler(file.oldUri, context, workspaceFolder, true));
		}
		else if (!oldUriIncluded && newUriIncluded) {
			promises.push(saveHandler(file.newUri, context, workspaceFolder, true));
		}
	}
	await Promise.all(promises);
}

async function deleteHandler(
	uri: vscode.Uri,
	context: vscode.ExtensionContext,
	workspaceFolder: string,
	force: boolean = false,
): Promise<void> {
	await sleep(100);
	if (
		!fileFilter(uri) ||
		(!force && recentRenameDelete.has(uri.fsPath))
	) { return; }

	const [_, api] = getBatchSizeAndApi(workspaceFolder);
	await fetchApi(api, vscode.workspace.asRelativePath(uri, false), 'DELETE');
	let lastScan: Record<string, number> = context.workspaceState.get('lastScan', {});
	delete lastScan[vscode.workspace.asRelativePath(uri, false)];
	await context.workspaceState.update('lastScan', lastScan);
}

let fsWatcherRegistered: boolean = false;
export function registerFsWatcher(
	context: vscode.ExtensionContext,
	workspaceFolder: string,
): void {
	if (fsWatcherRegistered) { return; }
	fsWatcherRegistered = true;

	const watcherDisposable = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceFolder, getConfig('include')),
		false, false, false
	);
	watcherDisposable.onDidChange(uri => saveHandler(uri, context, workspaceFolder));
	watcherDisposable.onDidCreate(uri => saveHandler(uri, context, workspaceFolder));
	watcherDisposable.onDidDelete(uri => deleteHandler(uri, context, workspaceFolder));

	const renameWatcherDisposable = vscode.workspace.onDidRenameFiles(event => renameHandler(event, context, workspaceFolder));

	context.subscriptions.push(watcherDisposable);
	context.subscriptions.push(renameWatcherDisposable);
}