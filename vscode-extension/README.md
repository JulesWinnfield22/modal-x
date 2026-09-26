# Modal-X Navigator

Jump from a modal **name** straight to its `.vue` source file.

```js
openModal('GuardModal', …)   // Ctrl+Click / F12  →  src/components/GuardModal.mdl.vue
MODALS.GuardModal            // Ctrl+Click / F12  →  src/components/GuardModal.mdl.vue
```

Works in **plain-JavaScript** projects and **directly inside `.vue` files** — no `tsconfig`,
no TypeScript, no "Use Workspace Version" step. (For pure-TypeScript projects in any editor,
the `@customizer/modal-x/ts-plugin` language-service plugin does the same thing.)

## Install (not on the Marketplace yet)

Until this is published to the VS Code Marketplace, install it from the bundled `.vsix`:

1. Download [`modal-x-navigator-0.1.0.vsix`](modal-x-navigator-0.1.0.vsix).
2. Install it, either:
   - **VSCode UI:** Extensions panel → `···` → **Install from VSIX…** → select the file, or
   - **Terminal:** `code --install-extension modal-x-navigator-0.1.0.vsix`
3. **Reload the window** (Command Palette → *Developer: Reload Window*).

The Vite plugin must have run at least once so `modalx.sources.json` exists (see *How it works*).

## How it works

The [Modal-X](https://github.com/JulesWinnfield22/modal-x) Vite plugin generates a
`modalx.sources.json` map (a `{ modalName: filePath }` object) into your installed package.
This extension reads that map and registers a "Go to Definition" provider for `.vue`, `.js`,
and `.ts` files. When you invoke Go to Definition on a modal name passed to `openModal(...)`
(or a `MODALS.*` member), it opens the corresponding modal file.

Requires the Vite plugin to have run at least once (so `modalx.sources.json` exists). The map is
searched at, in order:

1. `<workspace>/node_modules/@customizer/modal-x/modalx.sources.json`
2. `<workspace>/node_modules/modal-x/modalx.sources.json`
3. `<workspace>/modalx.sources.json`

## Develop / run locally

- Open this `vscode-extension/` folder in VSCode and press **F5** to launch an Extension
  Development Host, then open your app and Ctrl+Click a modal name.

## Package / install

```bash
cd vscode-extension
npx @vscode/vsce package        # produces modal-x-navigator-<version>.vsix
```

Install the `.vsix`: VSCode → Extensions panel → "…" menu → **Install from VSIX…**, or

```bash
code --install-extension modal-x-navigator-0.1.0.vsix
```
