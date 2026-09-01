// useCloseGuard — confirm before a modal closes when tracked values are dirty.
// Core-only (no vue-router). Works for a form (or anything) rendered inside a
// modal-x modal: it hooks the existing onBeforeModalClose, which runs for every
// close path (X button, overlay click, ESC, browser Back, programmatic close).

import { onUnmounted } from "vue";
import { useModal } from "../store/modal.js";
import { createDirtyState, makeConfirm, installBeforeUnload } from "./shared.js";

/**
 * @typedef {import("./shared.js").DirtyStateOptions & import("./shared.js").ConfirmOptions & {
 *   enabled?: () => boolean,
 *   isSubmitting?: () => boolean,
 *   beforeUnload?: boolean,
 * }} CloseGuardOptions
 */

/**
 * Guard the closing of the host modal. Call from within a modal's content
 * component setup.
 *
 * @param {CloseGuardOptions} opts
 * @returns {{ isDirty: () => boolean, markPristine: () => void }}
 */
export function useCloseGuard(opts) {
  const { onBeforeModalClose, modals } = useModal();
  const { dirty, markPristine } = createDirtyState(opts);
  // Modal-close context: the confirmation gets its own history entry so a 2nd
  // browser Back pops IT (handled by the history manager) rather than escaping.
  const confirm = makeConfirm({ ...opts, confirmInHistory: true });

  // Record the double-back policy on the modal being guarded (the current
  // topmost) so the history manager can honor it when the discard-confirmation
  // is showing. Per-guard `onDoubleBack` overrides the library-wide default.
  if (opts.onDoubleBack && modals[0]) {
    modals[0].options = {
      ...(modals[0].options || {}),
      onDoubleBack: opts.onDoubleBack,
    };
  }

  const off = onBeforeModalClose(async () => {
    if (opts.enabled?.() === false) return true;
    if (opts.isSubmitting?.() === true) return true;
    if (!dirty()) return true;
    return await confirm();
  });

  let removeBeforeUnload = () => {};
  if (opts.beforeUnload !== false && typeof window !== "undefined") {
    removeBeforeUnload = installBeforeUnload(dirty, opts);
  }

  onUnmounted(() => {
    off?.();
    removeBeforeUnload();
  });

  return { isDirty: dirty, markPristine };
}
