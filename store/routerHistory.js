// Router-mode browser-history integration for modal-x.
//
// When a vue-router instance is provided (app.use(modal, { router })), opening a
// modal is a real query-param route change (`?_mx=<id>`), and the browser Back
// is handled through vue-router's OWN navigation system via a global
// `beforeEach` guard — the same mechanism the route-leave guard already uses
// reliably. This avoids fighting `popstate` directly (which some setups let
// vue-router swallow before our listener runs).
//
// Pattern (mirrors useLeaveGuard): on a Back that would close the top modal we
// BLOCK the navigation immediately (return false → stay on the modal route),
// run the modal's beforeClose guard (which shows the dirty-confirmation), and
// only if it resolves truthy do we navigate for real (bypass flag) to drop the
// `?_mx` entry and close the modal.

import { dlog, getModalConfig, sharedState } from "./modal.js";

// Shared across every loaded copy of modal-x: a bypass set by one copy's
// closeModal must reach the guard another copy installed.
//   bypass:     set when WE trigger a navigation that should pass through
//   confirming: a close-confirmation is currently being decided
const nav = () =>
  sharedState("routerNav", () => ({ installed: false, bypass: false, confirming: false }));

/** Let the next router navigation through untouched (used by closeModal when it
 *  programmatically drops a modal's `?_mx` entry on X/ESC/overlay/button close). */
export function setRouterBypass() {
  nav().bypass = true;
}

/**
 * Run `action` once the browser's history pointer is on the entry matching
 * `isOnEntry(resolvedLocation)` — right away if it already is, else on the
 * popstate that lands there. A guard that blocks a Back makes vue-router revert
 * it asynchronously; a history move made before that revert lands is applied
 * from the wrong entry (and overshoots).
 */
export function whenOnEntry(router, isOnEntry, action) {
  const onEntry = () => isOnEntry(router.resolve(router.options.history.location));
  if (onEntry()) return action();
  const onPop = () => {
    if (!onEntry()) return;
    window.removeEventListener("popstate", onPop);
    action();
  };
  window.addEventListener("popstate", onPop);
}

export function installRouterHistory(router, api) {
  const s = nav();
  if (s.installed || !router) return;
  s.installed = true;
  const { modals, closeModal } = api;

  // 2nd-Back policy while the confirmation is showing (per-modal option wins,
  // else the library default, else 'stay').
  const resolveDoubleBack = (modal) =>
    modal?.options?.onDoubleBack || getModalConfig().onDoubleBack || "stay";

  router.beforeEach((to) => {
    if (s.bypass) {
      s.bypass = false;
      dlog("beforeEach: bypass -> allow");
      return true;
    }

    // The top ROUTED modal (a showing confirmation is skipHistory and sits above
    // it, so use find() rather than modals[0]).
    const routed = modals.find((m) => m._mxRouted);
    // Not our concern: no routed modal open, or navigation is still ON this
    // modal's route (opening it / forward onto it).
    if (!routed) return true;
    if (to.query._mx === routed._mxId) return true;

    dlog("beforeEach: closing routed modal via nav", routed.modalToOpen, "confirming=", s.confirming);

    // A confirmation is already on screen (2nd Back, or it was opened by a
    // button/X close in closeModal). Apply the double-back policy (default 'stay'
    // = behave like a normal modal: the Back dismisses only the confirmation and
    // the edited modal stays open). Always block the raw navigation.
    const confirmShowing = modals[0]?.options?.guardConfirm;
    if (s.confirming || confirmShowing) {
      const policy = resolveDoubleBack(routed);
      dlog("  back while confirm showing, policy=", policy);
      if (policy === "close") {
        // Proceed: resolve the confirmation → the pending guard closes the modal.
        // A Back-started close drops ?_mx in its `.then` below; a button/X close
        // (pending inside closeModal) leaves that to us, as its own cleanup
        // would race this blocked Back's revert.
        const buttonClose = !s.confirming && routed._closing;
        if (buttonClose) routed._routeDropped = true;
        closeModal(true, true, { fromRoute: true });
        s.confirming = false;
        if (buttonClose) leaveEntry(routed, to);
      } else if (policy === "ignore") {
        // Absorb: keep the confirmation open; leave `confirming` set so further
        // Backs are absorbed too. The user resolves it with its buttons.
      } else {
        // 'stay' (default): cancel the confirmation → the edited modal stays open.
        closeModal(false, true, { fromRoute: true });
        s.confirming = false;
      }
      return false;
    }

    // First close attempt. Block immediately (stay on the modal route), then run
    // the guard. If it allows, navigate for real to drop `?_mx`.
    s.confirming = true;
    closeModal(undefined, true, { fromRoute: true }).then((closed) => {
      s.confirming = false;
      dlog("  guard resolved closed=", closed);
      if (!closed) return; // vetoed (Cancel) → stay; navigation was already blocked.
      leaveEntry(routed, to);
    });
    return false;
  });

  // Re-navigate from a closed modal's `?_mx` entry to `to`, once the blocked
  // Back's revert has landed back on it.
  function leaveEntry(routed, to) {
    whenOnEntry(router, (loc) => loc.query._mx === routed._mxId, () => {
      if (modals.includes(routed)) {
        // Still open (its guard hasn't finished): its own cleanup drops ?_mx.
        routed._routeDropped = false;
        return;
      }
      s.bypass = true;
      if (to.fullPath === routed._mxFrom) {
        // Back to the page below: pop the `?_mx` entry. Pushing the page anew
        // would leave `?_mx` behind, reachable by the next Back.
        dlog("  -> router.back() to drop ?_mx");
        router.back();
      } else {
        // Navigating elsewhere: the destination replaces the `?_mx` entry.
        dlog("  -> router.replace", to.fullPath);
        router.replace(to.fullPath);
      }
    });
  }

  dlog("router history installed");
}
