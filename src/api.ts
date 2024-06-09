import { fetchApi } from './utils';
import { QuerySymbol } from './types';
import * as vscode from 'vscode';

export async function embeddingsInference(
	api: string,
	batchSize: number,
	queries: Record<string, QuerySymbol>,
): Promise<void> {
	if (Object.keys(queries).length <= batchSize * 2) {
		for (let i = 0; i < Object.keys(queries).length; i += batchSize) {
			const batch = Object.keys(queries).slice(i, i + batchSize);
			await fetchApi(api, 'index', 'POST', {
				input_strings: batch.map(key => queries[key].contents),
				input_labels: batch,
			});
		}
	}
	else {
		const progress = vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Indexing files',
			cancellable: false,
		}, async progress => {
			for (let i = 0; i < Object.keys(queries).length; i += batchSize) {
				const batch = Object.keys(queries).slice(i, i + batchSize);
				await fetchApi(api, 'index', 'POST', {
					input_strings: batch.map(key => queries[key].contents),
					input_labels: batch,
				});
				progress.report({ increment: batchSize / Object.keys(queries).length * 100 });
			}
		});
	}
}

export async function embeddingsQuery(
	api: string,
	query: string,
): Promise<Record<string, number>> {
	const res = await fetchApi(api, 'index', 'POST', {
		input_strings: [query],
	}) as Record<string, number>;
	return res;
}