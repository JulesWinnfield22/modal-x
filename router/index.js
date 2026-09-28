// vue-router-aware guard composables. Shipped as the `@customizer/modal-x/router`
// subpath so the core package stays vue-only — import from here only in apps that
// use vue-router.

import { inject, onUnmounted } from "vue";
import { useRouter, onBeforeRouteLeave, matchedRouteKey } from "vue-router";
import { createDirtyState, makeConfirm, installBeforeUnload } from "../guards/shared.js";
import { useCloseGuard } from "../guards/useCloseGuard.js";
import { whenOnEntry } from "../store/routerHistory.js";

/**
 * @typedef {import("../guards/shared.js").DirtyStateOptions
 *   & import("../guards/shared.js").ConfirmOptions & {
 *     enabled?: () => boolean,
 *     isSubmitting?: () => boolean,
 *     beforeUnload?: boolean,
 *   }} GuardOptions
 */

/**
 * Guard browser Back / route navigation away from the current route when tracked
 * values are dirty. Call from within a routed component's setup.
 *
 * Uses a "block-then-navigate-programmatically" model: a raw leave attempt is
 * always blocked (`return false`) while the confirmation is shown; on confirm we
 * navigate for real — `router.back()` for a browser Back (so this page isn't left
 * reachable by the next Back), `router.push` for anything else. A second Back
 * while the confirmation is up dismisses it and stays put. This avoids the
 * fragile await-inside-guard race and needs no `skipHistory` juggling against
 * modal-x's history manager.
 *
 * @param {GuardOptions} opts
 * @returns {{ isDirty: () => boolean, markPristine: () => void }}
 */
export function useLeaveGuard(opts) {
  const router = useRouter();
  const { dirty, markPristine } = createDirtyState(opts);
  const confirm = makeConfirm(opts);

  let confirming = false;
  let bypass = false;

  onBeforeRouteLeave((to, from) => {
    if (bypass) {
      bypass = false;
      return true; // our own confirmed navigation
    }
    if (opts.enabled?.() === false) return true;
    if (opts.isSubmitting?.() === true) return true;
    if (!dirty()) return true;

    if (confirming) {
      confirm.cancel(); // 2nd Back → dismiss confirmation + stay
      return false;
    }

    // Read NOW, before vue-router reverts the blocked navigation: on a browser
    // Back the browser has already moved onto `to`, and vue-router's state for
    // that entry records the page we're leaving as its `forward`.
    const isBack = router.options.history.state?.forward === from.fullPath;

    confirming = true;
    confirm().then((ok) => {
      confirming = false;
      if (!ok) return;
      // Re-navigate from this page's entry, once a blocked Back's revert has
      // landed back on it.
      whenOnEntry(router, (loc) => loc.fullPath === from.fullPath, () => {
        bypass = true;
        // A Back: step back onto `to` — pushing it anew would leave this page
        // reachable by the next Back. Anything else (a link) is a normal push.
        if (isBack) router.back();
        else router.push(to.fullPath);
      });
    });
    return false; // 1st Back → stay while asking
  });

  let removeBeforeUnload = () => {};
  if (opts.beforeUnload !== false && typeof window !== "undefined") {
    removeBeforeUnload = installBeforeUnload(dirty, opts);
  }
  onUnmounted(() => removeBeforeUnload());

  return { isDirty: dirty, markPristine };
}

/**
 * Context-aware guard ("one for both"): if the component is rendered inside a
 * route (`matchedRouteKey` present) it guards route navigation via
 * {@link useLeaveGuard}; otherwise it's inside a modal and guards the modal
 * close via {@link useCloseGuard}. In both cases it also wires `beforeunload`.
 *
 * This is the drop-in for a form component that may live either on a route or
 * inside a modal — the modal itself doesn't need to know which.
 *
 * @param {GuardOptions} opts
 * @returns {{ isDirty: () => boolean, markPristine: () => void }}
 */
export function useUnsavedGuard(opts) {
  const matchedRoute = inject(matchedRouteKey, null);
  return matchedRoute ? useLeaveGuard(opts) : useCloseGuard(opts);
}

export { useCloseGuard };
