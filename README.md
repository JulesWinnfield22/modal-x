# ✨ Modal-X (Vue)

**The most lightweight, file-based modal system for Vue 3.**  
Easily manage complex modal stacks with zero boilerplate, full type safety, and automatic code-splitting.

---

## ⚡ Features

- 📁 **File-Based Routing**: Your file structure defines your modals. No more giant index files.
- 📚 **Smart Stacking**: Open infinite modals on top of each other. Focus and scroll management handled automatically.
- 🦄 **Zero Dependencies**: **No longer requires Pinia!** Lightweight and fast.
- 🎯 **Type Safety**: Automatic type generation for modal names, props, and return values.
- ⚡ **Lazy Loading**: Automatic code-splitting for `*.amdl.vue` files.
- 🎨 **Dynamic Spinners**: Built-in support for global and modal-specific loading skeletons.
- 🔙 **Browser Back Integration**: The browser **Back** button closes the top modal (optionally after a confirmation) instead of navigating your app away — via **vue-router** (recommended) or a **popstate fallback**.
- 📝 **Unsaved-Changes Guards**: Drop-in composables (`useCloseGuard` / `useLeaveGuard` / `useUnsavedGuard`) to confirm before closing a dirty modal or leaving a dirty route.
- 📦 **Pure ESM Distribution**: Distributed as source files to allow Vite to perform global file scanning and perfect code-splitting in your project.

---

## 🚀 Installation

```bash
npm install @customizer/modal-x
```

> **Compatible with Vue 3 + Vite.**

---

## 🛠️ Setup

### 1. Register the Plugin

In your `main.js`:

```javascript
import { createApp } from "vue";
import modal from "@customizer/modal-x";
import App from "./App.vue";

const app = createApp(App);
app.use(modal); // This adds the <Modal /> root for you automatically
app.mount("#app");
```

> [!IMPORTANT]
> **Using vue-router? Pass your router instance.** This enables the reliable
> **router mode** for the browser Back button (see
> [Browser Back & History Integration](#-browser-back--history-integration-v04)).
> Register the router **before** modal-x.
>
> ```javascript
> import router from "./router";
>
> app.use(router);
> app.use(modal, { router }); // ← enables router mode
> ```
>
> Apps **without** vue-router need no options — a popstate fallback is used automatically.

### 2. Configure Vite (Optional but Recommended)

Add the `modalx` plugin to your `vite.config.js` to enable automatic type generation and full IDE support.

```javascript
import { modalTypesPlugin } from "@customizer/modal-x/modalxPlugin.cjs";

export default defineConfig({
  plugins: [
    vue(),
    modalTypesPlugin({
      autoInference: true, // ✨ Magic Mode
    }),
  ],
});
```

---

## 🛡️ Type Safety

Modal-X provides automatic type inference for both **Props** (data passed in) and **ReturnType** (data returned from `closeModal`).

### 1. Define Types in your Modal

Inside your `*.mdl.vue` or `*.amdl.vue` file, simply export `Props` and `ReturnType`.

```html
<!-- src/modals/UserForm.mdl.vue -->
<script setup>
  // 1. Export Props for automatic 'data' validation
  export type Props = {
    userId: string,
    initialName: string
  }

  // 2. Export ReturnType for 'openModal' promise resolution
  export type ReturnType = {
    success: boolean,
    newName: string
  }

  // [MODAL-X] Managed Props: This block is auto-generated for strict type safety.
  defineProps<{ data: Props; close: (res: ReturnType) => void }>();
</script>

<template>
  <div>
    <h1>Editing: {{ data.initialName }}</h1>
    <!-- ✅ Using 'close' prop instead of global closeModal for type enforcement -->
    <button @click="close({ success: true, newName: 'Jane' })">Save</button>
  </div>
</template>
```

### 2. Enjoy Autocomplete & Inference

When you call `openModal`, TypeScript will now:

- Validate that the `data` object matches your `Props`.
- Correctly type the `await` result as your `ReturnType`.

> [!TIP]
> **Type-Safe Closing**: While the global `closeModal()` works, using the `close` prop passed to your modal is recommended. It enforces that you only return data that matches your `ReturnType`.

> [!TIP]
> You can use the `MODALS` constant for "Go to Definition" support, or just use a string—autocomplete will work for both!

```typescript
import { openModal, MODALS } from '@customizer/modal-x'

async function editUser() {
  // Option A: Using the constant (best for navigation)
  const result = await openModal(MODALS.UserForm, { ... })

  // Option B: Using a string (autocomplete still works!)
  const result = await openModal('UserForm', {
    userId: '123',
    initialName: 'John'
  })
}
```

---

## 📖 Usage

### Opening a Modal

Modals are just regular Vue files ending in `.mdl.vue` (eager) or `.amdl.vue` (lazy).

```html
<!-- AnyComponent.vue -->
<script setup>
  import { openModal } from "@customizer/modal-x";

  async function confirmDelete() {
    // ✅ Promise-based API
    const confirmed = await openModal(
      "Confirmation",
      {
        message: "Delete this item?",
      },
      undefined, // 3rd arg is the legacy callback slot — pass undefined to use the Promise
      {
        closeOnOverlayClick: true, // Close when clicking backdrop
        closeonEsc: true, // Close on Escape key
      },
    );

    if (confirmed) {
      // perform delete
    }
  }
</script>
```

### Handling Cancellation

When a modal is closed via the **Escape key** or a **Backdrop click**, the Promise resolves to `false`. To handle this with strict TypeScript, you should include `false` in your modal's `ReturnType`:

```typescript
// Inside MyModal.mdl.vue
export type ReturnType = { id: string } | false;
```

Then handle it in your calling code:

```typescript
const result = await openModal("MyModal");

if (result === false) {
  // Modal was cancelled
  return;
}
```

### Options

`openModal(name, data, cb, options)` — the **fourth** argument is an optional
settings object (the third is the legacy callback; pass `undefined` when using the
Promise API):

| Option                | Type                              | Default | Description                                                                 |
| :-------------------- | :-------------------------------- | :------ | :-------------------------------------------------------------------------- |
| `closeOnOverlayClick` | `boolean`                         | `true`  | Closes the modal when the backdrop is clicked.                             |
| `closeonEsc`          | `boolean`                         | `true`  | Closes the modal when the `Esc` key is pressed.                            |
| `skipHistory`         | `boolean`                         | `false` | Opt out of the browser-history integration (for transient confirmations/spinners). |
| `onDoubleBack`        | `'ignore' \| 'stay' \| 'close'`   | plugin default | Popstate-mode 2nd-Back policy for this modal (see [Browser Back](#-browser-back--history-integration-v04)). |

### Closing a Modal

Inside your modal file, you can either use the global `closeModal()` or the recommended `close` prop for type safety.

```html
<!-- src/modals/Confirmation.mdl.vue -->
<script setup>
  // Recommended: Type-safe props
  const props = defineProps<{
    data: any,
    close: (res: any) => void
  }>()
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h3>{{ data.message }}</h3>
      <button @click="close(true)">Yes</button>
      <button @click="close(false)">No</button>
    </div>
  </div>
</template>
```

---

## 🔙 Browser Back & History Integration (v0.4)

Modal-X makes the browser **Back** button close the top modal instead of navigating
your app away. It picks one of **two modes automatically**, based on whether you
give it a vue-router instance:

| Mode | When | How Back is handled | URL while open |
| :--- | :--- | :--- | :--- |
| **Router mode** _(recommended)_ | You pass `{ router }` to the plugin | Through vue-router's **`beforeEach`** guard | `?_mx=<id>` query is added |
| **Popstate fallback** | No router passed | A same-URL **`popstate`** scheme | URL is unchanged |

> [!WARNING]
> **If your app uses vue-router, you must pass it** (`app.use(modal, { router })`).
> If vue-router is present but *not* passed, the popstate fallback runs and can be
> unreliable — vue-router handles the `popstate` event first and our handler may
> not see the second Back. Passing the router routes Back through vue-router's own
> navigation system, which is reliable.
>
> Apps with **no** vue-router at all use the popstate fallback and work correctly.

### Router mode

Opening a modal performs a real, in-place navigation that adds a `?_mx=<id>` query
param (the route/page component does **not** change). The browser Back then becomes
a genuine vue-router navigation intercepted by a global `beforeEach` guard:

- **Back on a plain (unguarded) modal** → the modal closes, `?_mx` is removed.
- **Back on a guarded modal with unsaved changes** → navigation is blocked and your
  confirmation is shown; the URL stays at `?_mx`.
- **Confirm** (or press **Back again** while the confirmation is showing) → both the
  confirmation and the modal close, and `?_mx` is removed.
- **Cancel** → the confirmation closes and the modal stays open.
- The modal's **X / ESC / overlay** close of a guarded modal is routed through the
  same guard, so button-close and Back behave identically.

### Popstate fallback (no vue-router)

Each non-transient modal pushes a few hidden, **same-URL** history entries when it
opens (the URL bar never changes). Back is handled with a "let it pop, re-arm a
buffer, run the guard" technique. What a second Back does while the confirmation is
showing is configurable per the **`onDoubleBack`** option:

| `onDoubleBack` | 2nd Back while confirmation is showing |
| :--- | :--- |
| `'ignore'` _(default)_ | Ignored — the confirmation stays open; resolve it with its buttons |
| `'stay'` | Closes only the confirmation; the edited modal stays open |
| `'close'` | Closes the confirmation **and** the edited modal |

### Intercepting a close — `onBeforeModalClose`

This is the low-level hook both modes build on. It runs for **every** close path —
X button, overlay click, ESC, browser Back, and programmatic `closeModal()` — and
returns `true` to allow the close or `false` to keep the modal open (a `Promise` is
awaited, so you can show an async confirmation).

```html
<!-- src/modals/EditThing.mdl.vue -->
<script setup>
  import { onBeforeModalClose, openModal } from "@customizer/modal-x";

  // Return true to allow the close, false to keep the modal open.
  onBeforeModalClose(async () => {
    if (!isDirty.value) return true;
    // Transient confirmations must not push their own history entry:
    return await openModal(
      "ConfirmationModal",
      { message: "Discard unsaved changes?" },
      undefined,
      { skipHistory: true },
    );
  });
</script>
```

> Most apps won't call `onBeforeModalClose` directly — the
> [Unsaved-Changes Guards](#-unsaved-changes-guards-v04) below wrap it (and dirty
> tracking + a confirmation) into a one-liner.

### Notes

- **`{ skipHistory: true }`** in the modal `options` (4th arg of `openModal`) opts a
  transient modal — confirmations, spinners — out of the history integration.
- **`forceCloseModal(response)`** closes the top modal while **skipping** the
  `beforeClose` guard (e.g. right after a successful submit, where a dirty-form
  prompt would be wrong).
- **Forward** does not reconstruct a closed modal (a modal's `data` isn't
  serializable into history state).
- Set **`debugHistory: true`** in the plugin options to log every history/Back
  decision to the console (prefixed `[modalx]`) while diagnosing.

---

## 📝 Unsaved-Changes Guards (v0.4)

Three composables turn "confirm before you lose unsaved changes" into a one-liner.
They track values, and when dirty, run a confirmation before the modal closes or the
route is left — for **every** trigger (X, ESC, overlay, browser Back, tab close).

| Composable | Import from | Guards | Requires vue-router |
| :--- | :--- | :--- | :--- |
| `useCloseGuard` | `@customizer/modal-x` | A **modal** closing | No |
| `useLeaveGuard` | `@customizer/modal-x/router` | A **route** being left | Yes |
| `useUnsavedGuard` | `@customizer/modal-x/router` | **Either** (auto-detects) | Yes |

> The router-aware composables live under the **`@customizer/modal-x/router`**
> subpath so the core package stays vue-only.

### A form inside a modal — `useCloseGuard`

```html
<!-- src/modals/EditUser.mdl.vue -->
<script setup>
  import { ref } from "vue";
  import { useCloseGuard } from "@customizer/modal-x";

  const form = ref({ name: "", email: "" });

  const { isDirty, markPristine } = useCloseGuard({
    track: () => form.value, // watched for changes
    message: "You have unsaved changes. Discard them?",
    confirmText: "Discard",
    cancelText: "Keep editing",
  });

  async function save() {
    await api.save(form.value);
    markPristine(); // reset the baseline so closing no longer prompts
  }
</script>
```

### A form on a route — `useLeaveGuard`

```html
<script setup>
  import { useLeaveGuard } from "@customizer/modal-x/router";

  useLeaveGuard({
    track: () => form.value,
    message: "Leave without saving?",
  });
</script>
```

### Works in both places — `useUnsavedGuard`

Use this in a form component that might be rendered **either** on a route **or**
inside a modal — it detects the context and guards the right thing.

```html
<script setup>
  import { useUnsavedGuard } from "@customizer/modal-x/router";
  useUnsavedGuard({ track: () => form.value });
</script>
```

### Guard options

| Option | Type | Description |
| :--- | :--- | :--- |
| `track` | `() => any` | Values to watch. A pristine snapshot is captured on setup and compared (uses the dirty helpers below). |
| `pristine` | `() => any` | Explicit baseline getter (defaults to the first `track()` value). |
| `isDirty` | `() => boolean` | Bring-your-own dirty check; takes precedence over `track`/`pristine`. |
| `onConfirm` | `(signal: AbortSignal) => boolean \| Promise<boolean>` | Bring-your-own confirmation UI. The `signal` aborts when the guard wants to cancel (e.g. a 2nd Back). Defaults to the built-in `ConfirmationModal`. |
| `modal` | `string` | Built-in confirmation modal name (default `"ConfirmationModal"`). |
| `title` / `message` / `confirmText` / `cancelText` | `string` | Text passed to the built-in confirmation. |
| `enabled` | `() => boolean` | Return `false` to disable the guard entirely. |
| `isSubmitting` | `() => boolean` | Return `true` to skip the guard while a submit is in flight. |
| `beforeUnload` | `boolean` | Also guard tab-close / refresh via the native `beforeunload` prompt (default `true`). |
| `onDoubleBack` | `'ignore' \| 'stay' \| 'close'` | Popstate-mode double-back policy for this modal (overrides the plugin default). |

Every guard returns `{ isDirty, markPristine }` — call **`markPristine()`** after a
successful save (or once async data finishes loading) to reset the "dirty" baseline.

### Dirty-diff helpers

The value-comparison utilities are exported for standalone use. They ignore cosmetic
differences (trims strings; treats `""`/`null`/`undefined`/empty arrays as empty;
strips `fakeId` keys) so seeded-but-untouched form rows don't read as dirty.

```javascript
import { isDirty, normalizeForCompare, hashForCompare } from "@customizer/modal-x";

isDirty(pristineValues, currentValues); // → boolean
```

---

## ⚙️ Plugin Configuration

Pass library-wide options as the second argument to `app.use`:

```javascript
app.use(modal, {
  router,                 // your vue-router instance → enables router mode
  onDoubleBack: "ignore", // popstate-mode 2nd-Back policy (default 'ignore')
  backCushion: 6,         // popstate-mode: same-URL entries pushed per modal
  debugHistory: false,    // log history/Back decisions to the console
});
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `router` | vue-router `Router` | `undefined` | Enables **router mode**. Omit for the popstate fallback. |
| `onDoubleBack` | `'ignore' \| 'stay' \| 'close'` | `'ignore'` | Popstate-mode 2nd-Back behavior (see the table above). Router mode always closes both. |
| `backCushion` | `number` | `6` | Popstate-mode only: how many same-URL history entries each modal pushes (a deeper cushion survives rapid Back double-clicks). |
| `debugHistory` | `boolean` | `false` | Log every history/Back decision to the console (`[modalx]`). |

These are defaults; `onDoubleBack` can be overridden per modal via
`openModal(name, data, cb, { onDoubleBack: 'close' })` or via a guard's
`onDoubleBack` option.

---

## ⚠️ Breaking Changes (v3.0)

1. **Pinia Dropped**: You no longer need to setup a Pinia store to use Modal-X. The library now uses native Vue module-level reactivity.
2. **Promise-based `openModal`**: `openModal` now returns a `Promise`. While legacy callbacks are still supported, the Promise API is the recommended way to handle modal results.
3. **Automatic IDs**: Every modal in the stack now gets a unique instance ID automatically.

---

## ✨ Auto-Inference (Magic Mode)

Tired of writing the same `defineProps` boilerplate? Modal-X can do it for you.

When **Auto-Inference** is enabled, the Vite plugin will physically inject the necessary `defineProps` code into your modal files the moment you save them, as long as you have exported `Props` and `ReturnType`.

### 1. Enable in `vite.config.js`

```javascript
import { modalTypesPlugin } from "@customizer/modal-x/modalxPlugin.cjs";

export default defineConfig({
  plugins: [
    vue(),
    modalTypesPlugin({
      autoInference: true, // ✨ Enable Magic Mode
    }),
  ],
});
```

### 2. Just Build Your Modal

The plugin creates the instance for you. If you haven't defined types yet, it provides a generic version (`any`). As soon as you export `Props` or `ReturnType`, the plugin **automatically upgrades** the injected code. If you remove those exports, it **automatically cleans up** the injected block.

```html
<script setup lang="ts">
  // No types? No problem. Injected:
  // const { data, close } = defineProps<{ data: any; close: (res: any) => void }>();

  export type Props = { title: string };
  export type ReturnType = boolean;

  // [MODAL-X] AUTO-GENERATED INSTANCE
  defineProps<{ data: Props; close: (res: ReturnType) => void }>();
</script>
```

> [!TIP]
> **Dynamic Upgrades**: You can start building your modal with zero boilerplate and add type definitions later—the plugin will keep the `defineProps` block synced with your exports.

> [!CAUTION]
> **Source Modification**: This feature physically modifies your source files. It is smart enough to avoid duplicate injections or conflicts with manual `defineProps` calls. If you remove your `Props` or `ReturnType` exports later, the plugin will automatically **remove** the injected block for you on the next save.

---

## 🧪 Advanced Features

### Dynamic Loading Skeletons

Modal-X supports powerful tiered loading states:

- **Global Spinner (`*.g.vue`)**: Shown for any lazy modal that doesn't have a specific spinner.
- **Group Spinner (`Name.group.s.vue`)**: Links to any modal with the same group name (e.g., `AddUser.user.amdl.vue` will automatically use `UserSkeleton.user.s.vue`).
- **Individual Spinner (`ModalName.s.vue`)**: Highest priority; shown only for that specific modal.

### Custom Styling

The modal system uses a few standard classes for easy styling overrides:

- `.__modal-parent`: The root backdrop container.
- `.__modal`: The individual modal container.
- `.__active`: Applied to the topmost modal in the stack.

---

## 📄 License

MIT © JulesWinnfield22
