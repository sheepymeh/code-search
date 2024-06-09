import * as vscode from 'vscode';
import { getConfig, getBatchSizeAndApi, fetchApi } from './utils';
import { registerFsWatcher } from './watcher';
import { scanAll } from './scanner';
import { SearchTreeViewProvider } from './tree';

export async function activate(context: vscode.ExtensionContext) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders === undefined) { return; }
	if (workspaceFolders.length > 1) {
		vscode.window.showErrorMessage('Unable to use multi-root workspace');
		return;
	}
	const workspaceFolder = workspaceFolders[0].uri.fsPath;

	const tree = new SearchTreeViewProvider(workspaceFolder, context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('code-search.search', tree)
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('code-search.openSearchView', async () => {
			tree.show();
		})
	);

	if (getConfig('initOnWorkspaceStart')) {
		await scanAll(workspaceFolder, context);
		registerFsWatcher(context, workspaceFolder);
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('code-search.indexWorkspace', async () => {
			await scanAll(workspaceFolder, context);
			registerFsWatcher(context, workspaceFolder);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('code-search.resetIndex', async () => {
			const [_, api] = getBatchSizeAndApi(workspaceFolder);
			await context.workspaceState.update('lastScan', undefined);
			await fetchApi(api, '', 'DELETE');
			await scanAll(workspaceFolder, context);
			registerFsWatcher(context, workspaceFolder);
		})
	);
}

export function deactivate() {}
