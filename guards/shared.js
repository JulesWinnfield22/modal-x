// Shared internals for the dirty-guard composables (useCloseGuard / useLeaveGuard
// / useUnsavedGuard). Core-only — no vue-router imports here.

import { useModal, dlog, getModalConfig } from "../store/modal.js";
import { hashForCompare, normalizeForCompare, isDirty as isDirtyDiff } from "../dirty.js";

/**
 * @typedef {Object} DirtyStateOptions
 * @property {() => any} [track] - Getter for the current values to watch. When
 *   provided (and no `isDirty`), a pristine snapshot is captured and compared.
 * @property {() => any} [pristine] - Getter for the baseline. Defaults to the
 *   first `track()` value.
 * @property {() => boolean} [isDirty] - Bring-your-own dirty check. Takes
 *   precedence over `track`/`pristine`.
 */

/**
 * Builds a `dirty()` predicate plus a `markPristine()` re-baseline function.
 *
 * If `isDirty` is supplied it's used verbatim. Otherwise a stable hash of the
 * normalized `track()` value is captured now (setup time) and compared on each
 * `dirty()` call — cheap and clone-free. Call `markPristine()` after async data
 * loads or a successful submit to reset the baseline.
 *
 * @param {DirtyStateOptions} opts
 * @returns {{ dirty: () => boolean, markPristine: () => void }}
 */
export function createDirtyState(opts) {
  if (typeof opts.isDirty === "function") {
    return { dirty: opts.isDirty, markPristine: () => {} };
  }

  const read = () =>
    typeof opts.track === "function" ? opts.track() : undefined;

  const snapshot = () => hashForCompare(normalizeForCompare(read()));

  // Baseline: an explicit pristine getter if given, else the first tracked value.
  let baseHash =
    typeof opts.pristine === "function"
      ? hashForCompare(normalizeForCompare(opts.pristine()))
      : snapshot();

  return {
    dirty: () => snapshot() !== baseHash,
    markPristine: () => {
      baseHash =
        typeof opts.pristine === "function"
          ? hashForCompare(normalizeForCompare(opts.pristine()))
          : snapshot();
    },
  };
}

/**
 * @typedef {Object} ConfirmOptions
 * @property {(signal: AbortSignal) => boolean | Promise<boolean>} [onConfirm]
 *   Bring-your-own confirmation. Receives an AbortSignal that fires when the
 *   guard wants to cancel (e.g. a second browser Back). Resolve/return `true`
 *   to proceed, `false` to stay. Takes precedence over the built-in modal.
 * @property {string} [modal] - Built-in confirmation modal name (default
 *   "ConfirmationModal").
 * @property {string} [title]
 * @property {string} [message]
 * @property {string} [confirmText]
 * @property {string} [cancelText]
 */

/**
 * Builds a `confirm()` that resolves to whether the user chose to proceed, plus
 * a `cancel()` that dismisses an in-flight confirmation as "stay" (false).
 *
 * - With `onConfirm`: runs it with a fresh AbortController per call; `cancel()`
 *   aborts the signal so a well-behaved custom dialog can dismiss itself.
 * - Otherwise: opens the built-in modal-x confirmation with `skipHistory: true`
 *   (so modal-x's history manager doesn't push/pop an entry for it); `cancel()`
 *   closes it as `false`.
 *
 * @param {ConfirmOptions} opts
 * @returns {{ (): Promise<boolean>, cancel: () => void }}
 */
export function makeConfirm(opts) {
  const { openModal, closeModal } = useModal();
  let controller = null;

  const confirm = async () => {
    if (typeof opts.onConfirm === "function") {
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const ok = await opts.onConfirm(signal);
        return signal.aborted ? false : !!ok;
      } catch {
        return false; // abort/rejection → stay
      } finally {
        controller = null;
      }
    }

    // Modal-close guards want the confirmation to OWN a history entry so a 2nd
    // browser Back lands on it (and we close it) instead of leaking past the app.
    // Route-leave guards keep it out of history (skipHistory) — vue-router owns
    // that Back via onBeforeRouteLeave and an extra entry collides with it.
    // In ROUTER mode the confirmation must be transient (skipHistory): the Back
    // that would close it is handled by the router guard, not the confirm's own
    // entry. Only the popstate-mode close guard gives the confirm its own entry.
    const modalOpts = opts.confirmInHistory && !getModalConfig().router
      ? { guardConfirm: true }
      : { skipHistory: true, guardConfirm: true }; // guardConfirm marks the transient confirm
    dlog("guard: opening built-in confirm", opts.modal || "ConfirmationModal", modalOpts);
    const res = await openModal(
      opts.modal || "ConfirmationModal",
      {
        title: opts.title,
        message: opts.message,
        confirmText: opts.confirmText,
        cancelText: opts.cancelText,
      },
      undefined,
      modalOpts,
    );
    dlog("guard: confirm resolved ->", !!res);
    return !!res;
  };

  confirm.cancel = () => {
    dlog("guard: confirm.cancel()", controller ? "(abort custom)" : "(closeModal false)");
    if (controller) {
      controller.abort();
      controller = null;
    } else {
      // Built-in confirmation is the top modal — dismiss it as "stay".
      closeModal(false);
    }
  };

  return confirm;
}

/**
 * Registers a `beforeunload` listener that prompts when `dirty()` is true (and
 * the guard is enabled + not submitting). Returns a disposer. Chromium only
 * shows the native prompt when `returnValue` is set to a non-empty string.
 *
 * @param {() => boolean} dirty
 * @param {{ enabled?: () => boolean, isSubmitting?: () => boolean }} opts
 * @returns {() => void} disposer
 */
export function installBeforeUnload(dirty, opts) {
  const handler = (e) => {
    if (
      opts.enabled?.() !== false &&
      dirty() &&
      opts.isSubmitting?.() !== true
    ) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}

export { hashForCompare, normalizeForCompare, isDirtyDiff };
