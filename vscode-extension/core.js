// Pure, editor-agnostic detection logic for the Modal-X Navigator extension.
// No `vscode` import here so it can be unit-tested with plain Node.

// If `offset` sits inside a single-line quoted string, return its inner value
// and the absolute start/end offsets of that value; otherwise null.
function stringLiteralAround(text, offset) {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  let lineEnd = text.indexOf('\n', offset);
  if (lineEnd === -1) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  const rel = offset - lineStart;
  const re = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(line))) {
    const s = m.index;
    const e = m.index + m[0].length;
    if (rel >= s && rel <= e) {
      return { value: m[2], start: lineStart + s + 1, end: lineStart + e - 1 };
    }
  }
  return null;
}

// The `[\w$]+` identifier surrounding `offset`, or null.
function identifierAround(text, offset) {
  const isIdent = (c) => c !== undefined && /[\w$]/.test(c);
  let s = offset;
  let e = offset;
  while (s > 0 && isIdent(text[s - 1])) s--;
  while (e < text.length && isIdent(text[e])) e++;
  if (s === e) return null;
  return { value: text.slice(s, e), start: s, end: e };
}

// `true` when `openModal(` (optionally `x.openModal(`) immediately precedes the
// string, i.e. the string is the first argument. Whitespace/newlines allowed.
function isOpenModalFirstArg(before) {
  return /(?:^|[^\w$])openModal\s*\(\s*$/.test(before);
}

// Core entry point: given the full document text, a cursor offset, and the
// name->path map, return { name, start, end } if the cursor is on a navigable
// modal reference, else null.
//
//  - `openModal('Name', …)`         (string literal, first arg)
//  - `foo.openModal('Name', …)`     (property-access callee)
//  - `MODALS.Name`                  (constant member access)
function findModalNameAt(text, offset, sources) {
  const str = stringLiteralAround(text, offset);
  if (str) {
    const before = text.slice(Math.max(0, str.start - 1 - 400), str.start - 1);
    if (isOpenModalFirstArg(before) && sources[str.value]) {
      return { name: str.value, start: str.start, end: str.end };
    }
    return null;
  }

  const id = identifierAround(text, offset);
  if (id) {
    const before = text.slice(Math.max(0, id.start - 40), id.start);
    if (/MODALS\s*\.\s*$/.test(before) && sources[id.value]) {
      return { name: id.value, start: id.start, end: id.end };
    }
  }
  return null;
}

module.exports = { findModalNameAt, stringLiteralAround, identifierAround, isOpenModalFirstArg };
