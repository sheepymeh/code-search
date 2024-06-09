import * as vscode from 'vscode';
import { expandFilterSymbols, fetchApi, getBatchSizeAndApi } from './utils';

export class SearchTreeViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'calicoColors.colorsView';
	private _view?: vscode.WebviewView;

	constructor(
		private readonly workspaceFolder: string,
		private readonly _extensionUri: vscode.Uri,
	) { }

	private async performQuery(
		query: string
	): Promise<void> {
		const [_, api] = getBatchSizeAndApi(this.workspaceFolder);
		const results: Record<string, number>[] = await fetchApi(api, 'query', 'POST', { input_strings: [query] });
		this._view?.webview.postMessage({ type: 'results', results: results[0] });
	}

	private async findSymbol(
		file: string,
		query: string
	): Promise<void> {
		const uri = vscode.Uri.joinPath(vscode.Uri.file(this.workspaceFolder), file);
		let symbols: vscode.SymbolInformation[];
		try {
			symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri);
		}
		catch (e) {
			vscode.window.showErrorMessage(`Failed to get symbols for ${file}, does the file exist?`);
			console.error(e);
			return;
		}

		symbols = expandFilterSymbols(symbols);
		for (const symbol of symbols) {
			if (symbol.name === query) {
				const document = await vscode.workspace.openTextDocument(uri);
				const editor = await vscode.window.showTextDocument(document);
				editor.selections = [new vscode.Selection(symbol.location.range.start, symbol.location.range.end)];
				editor.revealRange(symbol.location.range);
				return;
			}
		}
		vscode.window.showErrorMessage(`Symbol ${query} not found in ${file}`);
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'query':
					this.performQuery(data.query);
					break;
				case 'find':
					this.findSymbol(data.file, data.symbol);
					break;
				default:
					console.error('Unknown message type from webview:', data.type);
					break;
			}
		});
	}

	public show() {
		if (this._view) { this._view.show(); }
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'main.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'style.css'));
		const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

		return `<!DOCTYPE html>
			<html lang='en'>
			<head>
				<meta charset='UTF-8'>
				<meta http-equiv='Content-Security-Policy' content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src ${webview.cspSource};">
				<meta name='viewport' content='width=device-width, initial-scale=1.0'>
				<link href='${styleUri}' rel='stylesheet'>
				<link href='${codiconsUri}' rel='stylesheet'>
			</head>
			<body>
				<input placeholder='Search...' autofocus>
				<div id='tree'></div>
				<script src='${scriptUri}'></script>
			</body>
			</html>`;
	}
}