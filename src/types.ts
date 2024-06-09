import { SymbolKind } from 'vscode';

export interface QuerySymbol {
	name: string;
	kind: SymbolKind;
	file: string;
	contents?: string;
}