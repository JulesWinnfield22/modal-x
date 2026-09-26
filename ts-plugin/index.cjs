// @customizer/modal-x — TypeScript Language Service Plugin
//
// Makes "Go to Definition" (F12 / Ctrl+Click) on the modal name passed to
// `openModal('SomeModal', ...)` jump straight into that modal's `.vue` source
// file, instead of doing nothing (a bare string literal has no symbol).
//
// It reads the `modalx.sources.json` map emitted by the Vite plugin
// (see modalxPlugin.cjs) — a `{ [modalName]: projectRootRelativePath }` object —
// and resolves those paths against the TS project's root.
//
// This runs inside `tsserver` at edit time only; it is never imported by
// runtime code and adds zero bytes to a consumer's app bundle.

const fs = require('node:fs');
const path = require('node:path');

const SOURCES_FILENAME = 'modalx.sources.json';
// Callees whose first string argument is treated as a modal name.
const MODAL_OPEN_FNS = new Set(['openModal', 'openModalAsync']);

function init(modules) {
  const ts = modules.typescript;

  function create(info) {
    const logger = info.project.projectService.logger;
    const log = (msg) => {
      try { logger.info('[modal-x ts-plugin] ' + msg); } catch (_) {}
    };

    const projectRoot = info.project.getCurrentDirectory();

    // Locate + load the name->path map. Prefer the copy next to this plugin
    // (i.e. the installed package root, alongside FileNameEnums.ts); fall back
    // to the project root for the library's own dev setup.
    let sources = {};
    let sourcesFile = '';
    const candidates = [
      path.resolve(__dirname, '..', SOURCES_FILENAME),
      path.resolve(projectRoot, SOURCES_FILENAME),
    ];
    const loadSources = () => {
      for (const candidate of candidates) {
        try {
          if (fs.existsSync(candidate)) {
            sources = JSON.parse(fs.readFileSync(candidate, 'utf-8')) || {};
            sourcesFile = candidate;
            return;
          }
        } catch (err) {
          log('failed reading ' + candidate + ': ' + err.message);
        }
      }
      sources = {};
    };
    loadSources();
    log('loaded ' + Object.keys(sources).length + ' modal source(s) from ' + (sourcesFile || '<none>'));

    // Resolve a modal name to an absolute, existing `.vue` path (or null).
    const resolveModalFile = (name) => {
      const rel = sources[name];
      if (!rel) return null;
      const abs = path.isAbsolute(rel) ? rel : path.resolve(projectRoot, rel);
      return fs.existsSync(abs) ? abs : null;
    };

    // Innermost node whose span contains `position`.
    const findNodeAtPosition = (sourceFile, position) => {
      let result = null;
      const visit = (node) => {
        if (position < node.getStart(sourceFile) || position > node.getEnd()) return;
        result = node;
        node.forEachChild(visit);
      };
      visit(sourceFile);
      return result;
    };

    // If `node` is (or sits inside) a string literal that is the first argument
    // of an `openModal(...)`-style call, return { name, literal }, else null.
    const matchModalNameArg = (node) => {
      let literal = node;
      // Walk up a couple of levels in case the cursor is on a token inside the literal.
      while (literal && !ts.isStringLiteralLike(literal)) {
        literal = literal.parent;
        if (!literal || ts.isCallExpression(literal)) return null;
      }
      if (!literal || !ts.isStringLiteralLike(literal)) return null;

      const call = literal.parent;
      if (!call || !ts.isCallExpression(call)) return null;
      if (call.arguments.length === 0 || call.arguments[0] !== literal) return null;

      // Callee is `openModal` or `something.openModal`.
      const callee = call.expression;
      let calleeName = '';
      if (ts.isIdentifier(callee)) calleeName = callee.text;
      else if (ts.isPropertyAccessExpression(callee)) calleeName = callee.name.text;
      if (!MODAL_OPEN_FNS.has(calleeName)) return null;

      const name = literal.text;
      if (!sources[name]) return null;
      return { name, literal };
    };

    const makeVueDefinition = (name, absFile) => ({
      fileName: absFile,
      textSpan: { start: 0, length: 0 },
      kind: ts.ScriptElementKind.moduleElement,
      name: name,
      containerKind: ts.ScriptElementKind.unknown,
      containerName: 'modal-x',
    });

    // --- Proxy the language service, decorating the definition providers ---
    const proxy = Object.create(null);
    for (const k of Object.keys(info.languageService)) {
      const original = info.languageService[k];
      proxy[k] = (...args) => original.apply(info.languageService, args);
    }

    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
      const prior = info.languageService.getDefinitionAndBoundSpan(fileName, position);
      try {
        const program = info.languageService.getProgram();
        const sourceFile = program && program.getSourceFile(fileName);
        if (!sourceFile) return prior;
        const node = findNodeAtPosition(sourceFile, position);
        if (!node) return prior;
        const match = matchModalNameArg(node);
        if (!match) return prior;
        const absFile = resolveModalFile(match.name);
        if (!absFile) return prior;

        const start = match.literal.getStart(sourceFile);
        return {
          textSpan: { start, length: match.literal.getEnd() - start },
          definitions: [makeVueDefinition(match.name, absFile)],
        };
      } catch (err) {
        log('getDefinitionAndBoundSpan error: ' + err.message);
        return prior;
      }
    };

    proxy.getDefinitionAtPosition = (fileName, position) => {
      const prior = info.languageService.getDefinitionAtPosition(fileName, position);
      try {
        const program = info.languageService.getProgram();
        const sourceFile = program && program.getSourceFile(fileName);
        if (!sourceFile) return prior;
        const node = findNodeAtPosition(sourceFile, position);
        if (!node) return prior;
        const match = matchModalNameArg(node);
        if (!match) return prior;
        const absFile = resolveModalFile(match.name);
        if (!absFile) return prior;
        return [makeVueDefinition(match.name, absFile)];
      } catch (err) {
        log('getDefinitionAtPosition error: ' + err.message);
        return prior;
      }
    };

    return proxy;
  }

  return { create };
}

module.exports = init;
