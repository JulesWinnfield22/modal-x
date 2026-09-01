// Browser-history integration for modal-x.
//
// Each non-transient modal pushes a hidden, SAME-URL history entry when it
// opens, so the browser Back button closes the topmost modal through its
// `beforeClose` guard instead of navigating the app away.
//
// `popstate` is NOT cancelable — the browser moves the history pointer before
// the event fires — so we can't "hold" Back. Because every entry shares the
// current URL, a pop is only a *position* change (the URL bar never moves); we
// compensate with a "let it pop, re-push a buffer, run the guard" model.

import { dlog } from "./modal.js";

let installed = false;
let ignorePops = 0;
let closingViaBack = false;
let bufferConsumedByBack = false;

/** Called by closeModal before it pops one of our own entries via history.back(). */
export function markIgnoredPop() {
  ignorePops++;
}

/**
 * Install the single popstate listener. `api` must expose the reactive `modals`
 * stack and the (options-aware) `closeModal`. Safe to call more than once.
 *
 * @param {{ modals: any[], closeModal: (res?: any, send?: boolean, opts?: object) => Promise<boolean> }} api
 */
export function installHistoryManager(api) {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const { modals, closeModal, getModalConfig } = api;

  // Resolve the double-back policy for the modal being guarded: its own
  // `options.onDoubleBack` wins, else the library-wide default, else 'ignore'.
  const resolveDoubleBack = (modal) =>
    modal?.options?.onDoubleBack ||
    getModalConfig?.().onDoubleBack ||
    "ignore";

  // Re-push a DEEP cushion of same-URL entries. An SPA router (e.g. vue-router)
  // can consume several of our entries when it processes the Back's popstate;
  // pushing a batch every time keeps enough spares below the pointer that the
  // *next* Back lands on one (fires our handler) instead of overshooting past
  // the app and unloading it. Reused on the 1st Back and on each subsequent one.
  const pushCushion = () => {
    const n = Math.max(1, getModalConfig?.().backCushion || 1);
    for (let i = 0; i < n; i++) window.history.pushState(window.history.state, "");
    dlog("  pushed cushion x", n, "-> len", window.history.length);
  };

  window.addEventListener("popstate", async () => {
    dlog(
      "popstate: ignorePops=", ignorePops,
      "closingViaBack=", closingViaBack,
      "bufferConsumed=", bufferConsumedByBack,
      "modals=", modals.map((m) => m.modalToOpen),
      "len=", window.history.length,
      "state=", window.history.state,
    );

    // 1. One of our own programmatic history.back() calls — consume and ignore.
    if (ignorePops > 0) {
      ignorePops--;
      dlog("  branch=ignorePop -> now", ignorePops);
      return;
    }

    // 2. Back pressed AGAIN while a Back-triggered confirmation is showing.
    //    Policy (per-modal or global):
    //    - 'close': close the confirmation as "proceed", cascading to close the
    //      guarded modal underneath.
    //    - 'stay' (default): cancel the confirmation and keep the guarded modal
    //      open. We MUST re-push a same-URL buffer here — the browser just
    //      consumed our previous one, so without re-arming, the next Back would
    //      fall past the underlying page and navigate the app away.
    if (closingViaBack) {
      bufferConsumedByBack = true;
      const edited = modals[1] || modals[0]; // the guarded modal (confirm is [0])
      const policy = resolveDoubleBack(edited);
      dlog("  branch=re-entrant(2nd back) policy=", policy, "confirm=", modals[0]?.modalToOpen, "edited=", edited?.modalToOpen);
      // The 2nd Back already popped the confirmation's own history entry. Always
      // re-push a same-URL entry so the app is never left; then apply the policy.
      // fromPopstate on closeModal → don't let it pop the (already-popped) entry.
      if (policy === "close") {
        // Close the confirmation as "proceed", cascading to close the edited modal.
        closeModal(true, true, { fromPopstate: true });
      } else if (policy === "stay") {
        // Close the confirmation as "cancel"; the edited modal stays open.
        closeModal(false, true, { fromPopstate: true });
      }
      // else 'ignore' (default): absorb the Back — keep the confirmation open;
      // the user resolves it via its Cancel/Confirm buttons.
      pushCushion(); // always re-arm so the app is never left
      dlog("  re-armed modals=", modals.map((m) => m.modalToOpen));
      return;
    }

    // 3. First Back with a modal open.
    const top = modals[0];
    if (!top || top.options?.skipHistory) {
      dlog("  branch=noop (no modal or skipHistory) top=", top?.modalToOpen);
      return;
    }
    dlog("  branch=firstBack top=", top.modalToOpen);

    // The browser already popped `top`'s own entry. Re-push a same-URL buffer so
    // the pointer is back at "modal open" depth and a further Back is absorbed.
    // Reuse the current history.state so we don't disturb an SPA router's
    // position tracking (see the note in store/modal.js openModal).
    pushCushion();
    dlog("  firstBack: re-armed cushion");
    closingViaBack = true;
    bufferConsumedByBack = false;

    let closed = false;
    try {
      closed = await closeModal(undefined, true, { fromPopstate: true });
    } finally {
      closingViaBack = false;
    }
    dlog("  firstBack: closeModal ->", closed, "bufferConsumed=", bufferConsumedByBack);

    if (closed && !bufferConsumedByBack) {
      // Allowed via the dialog (buffer still present) → drop it.
      ignorePops++;
      window.history.back();
      dlog("  firstBack: closed cleanly, history.back() to drop buffer");
    }
    // Vetoed → keep the buffer, modal stays open.
    // Closed via a second Back → buffer already consumed, nothing to do.
  });
}
