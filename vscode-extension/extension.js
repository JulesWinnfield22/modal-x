// Modal-X Navigator — VSCode extension
//
// Adds "Go to Definition" (F12 / Ctrl+Click) from a modal name to its .vue file:
//
//   openModal('GuardModal', …)   ──▶  src/components/GuardModal.mdl.vue
//   MODALS.GuardModal            ──▶  src/components/GuardModal.mdl.vue
//
// Unlike the TypeScript language-service plugin, this works in plain-JS projects
// and directly inside .vue files, with no tsconfig / workspace-TS setup. It reads
// the same `modalx.sources.json` map the Vite plugin generates.

const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./core.js');

const SOURCES_FILENAME = 'modalx.sources.json';

// Cache of { file, root, map } per workspace folder, refreshed when the map changes.
const cache = new Map();

function locateSourcesFile(root) {
  const candidates = [
    path.join(root, 'node_modules', '@customizer', 'modal-x', SOURCES_FILENAME),
    path.join(root, 'node_modules', 'modal-x', SOURCES_FILENAME),
    path.join(root, SOURCES_FILENAME),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function loadSourcesForRoot(root) {
  if (cache.has(root)) return cache.get(root);
  const file = locateSourcesFile(root);
  let map = {};
  if (file) {
    try {
      map = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch (_) {
      map = {};
    }
  }
  const entry = { file, root, map };
  cache.set(root, entry);
  return entry;
}

function rootForDocument(document) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (folder) return folder.uri.fsPath;
  // Fall back to the first workspace folder, if any.
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length ? folders[0].uri.fsPath : null;
}

function provideDefinition(document, position) {
  const root = rootForDocument(document);
  if (!root) return undefined;
  const { map, file } = loadSourcesForRoot(root);
  if (!file || !map || Object.keys(map).length === 0) return undefined;

  const text = document.getText();
  const offset = document.offsetAt(position);
  const hit = core.findModalNameAt(text, offset, map);
  if (!hit) return undefined;

  const rel = map[hit.name];
  const abs = path.isAbsolute(rel) ? rel : path.resolve(root, rel);
  if (!fs.existsSync(abs)) return undefined;

  const originSelectionRange = new vscode.Range(
    document.positionAt(hit.start),
    document.positionAt(hit.end),
  );
  const targetUri = vscode.Uri.file(abs);
  const targetStart = new vscode.Position(0, 0);
  // LocationLink lets us highlight the modal name as the click source.
  return [
    {
      originSelectionRange,
      targetUri,
      targetRange: new vscode.Range(targetStart, targetStart),
      targetSelectionRange: new vscode.Range(targetStart, targetStart),
    },
  ];
}

function activate(context) {
  const selector = [
    { language: 'vue', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'typescript', scheme: 'file' },
    { language: 'javascriptreact', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' },
  ];
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, { provideDefinition }),
  );

  // Invalidate cache when any sources map changes, so navigation stays current.
  const watcher = vscode.workspace.createFileSystemWatcher('**/' + SOURCES_FILENAME);
  const clear = () => cache.clear();
  watcher.onDidChange(clear);
  watcher.onDidCreate(clear);
  watcher.onDidDelete(clear);
  context.subscriptions.push(watcher);
}

function deactivate() {}

module.exports = { activate, deactivate };
