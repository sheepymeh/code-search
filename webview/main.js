(function() {
	const vscode = acquireVsCodeApi();
	const input = document.querySelector('input');
	const tree = document.getElementById('tree');

	let currentQuery = '';
	let debounce = null;

	function clearTree() {
		while (tree.firstChild) { tree.removeChild(tree.firstChild); }
	}

	function makeQuery(setDebounce) {
		if (debounce) { clearTimeout(debounce); }
		if (input.value === '') {
			clearTree();
			return;
		}
		vscode.postMessage({ type: 'query', query: input.value });

		if (setDebounce) {
			debounce = setTimeout(() => {
				vscode.postMessage({ type: 'query', query: input.value });
			}, 500);
		}
		currentQuery = input.value;
	}

	input.addEventListener('keydown', e => {
		switch (e.key) {
			case 'Enter':
				makeQuery(false);
				break;

			default:
				if (input.value !== currentQuery) { makeQuery(true); }
		}
	});

	tree.addEventListener('click', e => {
		const target = e.target;
		if (target.dataset.file) {
			if (target.textContent) {
				vscode.postMessage({ type: 'find', file: target.dataset.file, symbol: target.textContent });
			}
		}

		e.stopPropagation();
	});

	window.addEventListener('message', e => {
		switch (e.data.type) {
			case 'results':
				let newTree;
				if (e.data.results.length) {
					let files = {};
					for (const [result, score] of Object.entries(e.data.results)) {
						const [file, symbol] = result.split(':');
						if (!files[file]) { files[file] = []; }
						files[file].push(symbol);
					}
	
					newTree = document.createElement('ul');
					for (const [file, symbols] of Object.entries(files)) {
						const fileListItem = document.createElement('li');
						const fileNode = document.createElement('details');
						const fileName = document.createElement('summary');
						fileName.appendChild(document.createTextNode(file));
						fileNode.appendChild(fileName);
	
						const symbolList = document.createElement('ul');
						for (const symbol of symbols) {
							const symbolNode = document.createElement('li');
							symbolNode.dataset.file = file;
							symbolNode.appendChild(document.createTextNode(symbol));
							symbolList.appendChild(symbolNode);
						}
	
						fileNode.appendChild(symbolList);
						fileListItem.appendChild(fileNode);
						newTree.appendChild(fileListItem);
					}
				}
				else {
					newTree = document.createElement('strong');
					newTree.classList.add('empty-tree');
					newTree.appendChild(document.createTextNode('No results found.'));
				}

				clearTree();
				tree.appendChild(newTree);
				break;

			default:
				break;
		}
	});
})();