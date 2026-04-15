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

The third argument of `openModal` is an optional settings object:

| Option                | Type      | Default | Description                                     |
| :-------------------- | :-------- | :------ | :---------------------------------------------- |
| `closeOnOverlayClick` | `boolean` | `true`  | Closes the modal when the backdrop is clicked.  |
| `closeonEsc`          | `boolean` | `true`  | Closes the modal when the `Esc` key is pressed. |

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
