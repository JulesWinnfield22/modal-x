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

import { dlog, getModalConfig } from "./modal.js";

let installed = false;
let bypass = false;      // set when WE trigger a navigation that should pass through
let confirming = false;  // a close-confirmation is currently being decided

/** Let the next router navigation through untouched (used by closeModal when it
 *  programmatically drops a modal's `?_mx` entry on X/ESC/overlay/button close). */
export function setRouterBypass() {
  bypass = true;
}

export function installRouterHistory(router, api) {
  if (installed || !router) return;
  installed = true;
  const { modals, closeModal } = api;

  // 2nd-Back policy while the confirmation is showing (per-modal option wins,
  // else the library default, else 'stay').
  const resolveDoubleBack = (modal) =>
    modal?.options?.onDoubleBack || getModalConfig().onDoubleBack || "stay";

  router.beforeEach((to) => {
    if (bypass) {
      bypass = false;
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

    dlog("beforeEach: closing routed modal via nav", routed.modalToOpen, "confirming=", confirming);

    // A confirmation is already on screen (2nd Back, or it was opened by a
    // button/X close routed here). Apply the double-back policy (default 'stay'
    // = behave like a normal modal: the Back dismisses only the confirmation and
    // the edited modal stays open). Always block the raw navigation.
    const confirmShowing = modals[0]?.options?.guardConfirm;
    if (confirming || confirmShowing) {
      const policy = resolveDoubleBack(routed);
      dlog("  back while confirm showing, policy=", policy);
      if (policy === "close") {
        // Proceed: resolve the confirmation → the pending guard closes the modal
        // and its `.then` performs the real navigation (drops ?_mx).
        closeModal(true, true, { fromRoute: true });
        confirming = false;
      } else if (policy === "ignore") {
        // Absorb: keep the confirmation open; leave `confirming` set so further
        // Backs are absorbed too. The user resolves it with its buttons.
      } else {
        // 'stay' (default): cancel the confirmation → the edited modal stays open.
        closeModal(false, true, { fromRoute: true });
        confirming = false;
      }
      return false;
    }

    // First close attempt. Block immediately (stay on the modal route), then run
    // the guard. If it allows, navigate for real to drop `?_mx`.
    confirming = true;
    closeModal(undefined, true, { fromRoute: true }).then((closed) => {
      confirming = false;
      dlog("  guard resolved closed=", closed);
      if (closed) {
        bypass = true;
        router.push(to.fullPath); // real navigation → drops ?_mx, modal already removed
      }
      // else vetoed (Cancel) → stay; navigation was already blocked.
    });
    return false;
  });

  dlog("router history installed");
}
