# code-search

Local, natural language search in your editor

---

`code-search` provides an API and accompanying VS Code extension for natural language searching on your codebase.

## Installation

**You need both the [API](https://github.com/sheepymeh/code-search-backend) and the VS Code extension (this repository)**

### Backend

1. Extract the backend
2. Create a venv
4. Install backend dependencies (`pip install -r requirements.txt`)
5. Start the server with `python main.py`

### Extension
1. Open the extracted frontend in VS Code
2. Install dependencies (`npm ci`)
3. Press F5 to start a debugging window

Note that the [model](https://huggingface.co/jinaai/jina-embeddings-v2-base-code) will be downloaded after the extension is started in a workspace.

## Usage

The VS Code extension automatically indexes your workspace once started. It will also automatically update the index on saves, renames, and deletions.

If you notice that the index has gotten out-of-sync, you may reset the index by running "Reset indices and embeddings" from the command palette.

## Performance

Initial indexing may be slow especially on large codebases. You may adjust the included/excluded files in the VS Code settings.

### NPUs

The ONNX runtime is compatible with multiple NPU backends (execution providers). However, they have yet to be implemented.

## Roadmap

1. Package frontend/backend and upload to VS Code marketplace
2. NPU/GPU backends
3. Add more models (currently only supports the [Jina model](https://huggingface.co/jinaai/jina-embeddings-v2-base-code))
4. Improve UX of search sidebar
5. Re-implement caching for newly saved files
6. Consider `transformers.js` to remove the need for a backend (currently facing VS Code's RAM limit on extensions)
7. Implement [findFiles2 API](https://github.com/microsoft/vscode/issues/48674) to share VS Code's built-in file inclusion/exclusion policies